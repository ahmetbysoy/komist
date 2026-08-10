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
  constructor(bot, StreamClass = BinanceStream) {
    this.bot = bot;
    this.StreamClass = StreamClass;
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

  /** Kline geçmişi (REST) — barva35 fetchInitialData */
  async fetchInitialData(symbol, timeframe) {
    try {
      const res = await fetch(
        `${CONFIG.exchange.binanceRest}/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=500`,
        { signal: AbortSignal.timeout(10000) }
      );
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error('geçersiz kline yanıtı');
      return raw.map((d) => ({
        time: d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5]
      }));
    } catch (e) {
      Logger.warn('Exchange', 'Kline geçmişi alınamadı:', e.message);
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
