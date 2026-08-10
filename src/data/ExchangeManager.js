// NOT: WatchlistManager / BacktestEngine / CloudSyncManager REDDEDİLDİ (10.08.2026) — teklif edilmesin
/**
 * ExchangeManager — Veri akışı (barva35 handleMarketData mantığı)
 * WS verilerini ilgili modüllere dağıtır:
 *  ticker → marketData + pozisyon yönetimi   (market WS)
 *  depth  → orderBook + heatmap + spoof + strateji analyzeOrderBook (public WS)
 *  kline  → candles + chart + mum kapanışı (pending + indikatör) (market WS)
 *  aggTrade → strateji processTrade (market WS, live testte public altında da görülebilir)
 * Mock fallback: gerçek veri yoksa (CORS/ağ) random walk simülasyonu.
 *
 * P0 WS Migration: Binance 2026-04-23'te tek URL'yi kaldırdı, artık 2 routed endpoint var.
 * ExchangeManager tek bir BinanceStream örneği oluşturur, BinanceStream içinde 2 WebSocket yönetilir.
 * Dışarıdan API değişmez: connect(symbol,timeframe) → dual WS, disconnect() → ikisini kapat.
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';
import { BinanceStream } from './BinanceStream.js';
import { MockDataGenerator } from './MockDataGenerator.js';
import { ZebaniFilter } from './ZebaniFilter.js';

export class ExchangeManager {
  /**
   * @param {Object} bot
   * @param {Class} StreamClass - Borsa-agnostik: BinanceStream | BybitStream | OKXStream (aynı handler sözleşmesi)
   */
  constructor(bot, StreamClass = BinanceStream, exchangeName = null) {
    this.bot = bot;
    this.StreamClass = StreamClass;
    // Borsa adı: StreamClass adından çıkar veya storage'dan oku
    this.exchangeName = exchangeName || this._detectExchangeName(StreamClass);
    this.stream = new StreamClass({
      onTicker: (d) => this.bot.handleMarketData('ticker', d),
      onDepth: (d) => this.bot.handleMarketData('depth', d),
      onKline: (d) => this.bot.handleMarketData('kline', d),
      onAggTrade: (d) => this.bot.handleMarketData('aggTrade', d),
      onForceOrder: (d) => this.bot.handleMarketData('forceOrder', d),
      onMarkPrice: (d) => this.bot.handleMarketData('markPrice', d),
      onStatus: (s, delay) => this.bot.onConnectionStatus?.(s, delay)
    });
    this.mock = new MockDataGenerator({
      onBook: (snapshot) => this.bot._applyOrderBook(snapshot),
      onTrade: (t) => this.bot._processTrade(t),
      onTicker: (t) => this.bot._applyTicker(t)
    });
    this.zebani = new ZebaniFilter();
    this.mockActive = false;
  }

  connect(symbol, timeframe) {
    this.mock.stop();
    this.mockActive = false;
    this.zebani.reset();
    const streamName = this.StreamClass?.name || 'BinanceStream';
    Logger.info('ExchangeManager', `Connect ${symbol}@${timeframe} via ${streamName} → public:${CONFIG.exchange.binanceWsPublic} market:${CONFIG.exchange.binanceWsMarket}`);
    this.stream.connect(symbol, timeframe);
  }

  disconnect() {
    this.stream.close();
    this.mock.stop();
  }

  /** Sağlık: son veri zamanları (Watchdog teşhis için) */
  getHealth() {
    const ls = this.stream?.lastSeen || {};
    const now = Date.now();
    const age = (k) => ls[k] ? Math.round((now - ls[k]) / 1000) + 's' : 'hiç gelmedi';
    return {
      publicWs: this.stream?.publicWs?.readyState === 1 ? 'open' : 'closed',
      marketWs: this.stream?.marketWs?.readyState === 1 ? 'open' : 'closed',
      lastSeen: {
        ticker: age('ticker'),
        depth: age('depth'),
        kline: age('kline'),
        aggTrade: age('aggTrade')
      }
    };
  }

  _detectExchangeName(StreamClass) {
    // Minified build'de class name 'Ws' gibi kısalır, bu yüzden name'e güvenme
    // Doğrudan referans karşılaştırması yap (importlar varsa)
    try {
      // Dinamik import olmadan, sadece exchangeName parametresi güvenilir
      // Eğer StreamClass verilmiş ama exchangeName yoksa, default binance dön
      return 'binance';
    } catch(_) { return 'binance'; }
  }

  setExchange(exchangeName, StreamClass) {
    const map = { binance: 'BinanceStream', bybit: 'BybitStream', okx: 'OKXStream' };
    this.exchangeName = exchangeName;
    if (StreamClass) this.StreamClass = StreamClass;
    Logger.info('ExchangeManager', `Borsa değiştirildi: ${exchangeName} (${this.StreamClass?.name})`);
  }

  // Interval dönüşümleri
  _toBybitInterval(tf) {
    const map = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240' };
    return map[tf] || '15';
  }
  _toOkxBar(tf) {
    const map = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H' };
    return map[tf] || '15m';
  }
  _toOkxInstId(symbol) {
    // BTCUSDT -> BTC-USDT-SWAP, 1000PEPEUSDT -> 1000PEPE-USDT-SWAP
    if (symbol.includes('-')) return symbol;
    if (symbol.endsWith('USDT')) {
      const base = symbol.slice(0, -4);
      return `${base}-USDT-SWAP`;
    }
    return symbol;
  }

  /** Kline geçmişi (REST) — borsa-agnostik, normalize edilmiş */
  async fetchInitialData(symbol, timeframe) {
    const ex = this.exchangeName || 'binance';
    try {
      let url, headers = {};
      if (ex === 'bybit') {
        const interval = this._toBybitInterval(timeframe);
        url = `${CONFIG.exchange.bybitRest}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=500`;
      } else if (ex === 'okx') {
        const instId = this._toOkxInstId(symbol);
        const bar = this._toOkxBar(timeframe);
        url = `${CONFIG.exchange.okxRest}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=500`;
      } else {
        url = `${CONFIG.exchange.binanceRest}/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=500`;
      }

      const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers });
      const raw = await res.json();

      // Normalize her borsanın farklı şeması
      if (ex === 'bybit') {
        // Bybit: { result: { list: [ [startTime, open, high, low, close, volume, turnover], ... ] } }
        const list = raw?.result?.list || raw?.result?.data || [];
        if (!Array.isArray(list)) throw new Error('bybit kline geçersiz');
        // Bybit list en yeni önce döner, ters çevir
        return list.slice().reverse().map(d => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));
      } else if (ex === 'okx') {
        // OKX: { data: [ [ts, o, h, l, c, vol, volCcy, ...], ... ] } — en yeni önce
        const list = raw?.data || [];
        if (!Array.isArray(list)) throw new Error('okx kline geçersiz');
        return list.slice().reverse().map(d => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));
      } else {
        // Binance: [ [time, open, high, low, close, volume, ...], ... ]
        if (!Array.isArray(raw)) throw new Error('geçersiz kline yanıtı');
        return raw.map(d => ({
          time: d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5]
        }));
      }
    } catch (e) {
      Logger.warn('Exchange', `Kline geçmişi alınamadı (${ex} ${symbol}@${timeframe}):`, e.message);
      return [];
    }
  }

  /** Snapshot alınamazsa mock moda geç (App çağırır) */
  enableMock(symbol) {
    if (!CONFIG.useMockFallback) return;
    Logger.warn('Exchange', 'Gerçek veri yok — mock moda geçiliyor');
    this.mockActive = true;
    this.mock.start(symbol);
  }
}

export default ExchangeManager;
