/**
 * ExchangeManager — Veri akışı (barva35 handleMarketData mantığı)
 * WS verilerini ilgili modüllere dağıtır:
 *  ticker → marketData + pozisyon yönetimi
 *  depth  → orderBook + heatmap + spoof + strateji analyzeOrderBook
 *  kline  → candles + chart + mum kapanışı (pending + indikatör)
 *  aggTrade → strateji processTrade
 * Mock fallback: gerçek veri yoksa (CORS/ağ) random walk simülasyonu.
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';
import { BinanceStream } from './BinanceStream.js';
import { MockDataGenerator } from './MockDataGenerator.js';
import { ZebaniFilter } from './ZebaniFilter.js';

export class ExchangeManager {
  constructor(bot) {
    this.bot = bot;
    this.stream = new BinanceStream({
      onTicker: (d) => this.bot.handleMarketData('ticker', d),
      onDepth: (d) => this.bot.handleMarketData('depth', d),
      onKline: (d) => this.bot.handleMarketData('kline', d),
      onAggTrade: (d) => this.bot.handleMarketData('aggTrade', d),
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
    this.stream.connect(symbol, timeframe);
  }

  disconnect() {
    this.stream.close();
    this.mock.stop();
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
