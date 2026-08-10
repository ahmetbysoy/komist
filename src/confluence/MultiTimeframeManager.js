/**
 * MultiTimeframeManager — Çoklu zaman dilimi trend teyidi
 * Kaynak: barva35.html (MultiTimeframeManager) + UTC v2.0 §4.10
 * Her timeframe için REST klines; EMA(20) bazlı trend tespiti.
 */
import { CONFIG } from '../core/Config.js';
import { ema } from '../indicators/EMA.js';
import { Logger } from '../core/Logger.js';

const TIMEFRAMES = ['5m', '15m', '1h', '4h'];

export class MultiTimeframeManager {
  constructor(bot) {
    this.bot = bot;
    this.data = {};
    this.timers = [];
  }

  async initialize(symbol, timeframes = TIMEFRAMES) {
    this.cleanup();
    for (const tf of timeframes) {
      this.data[tf] = { candles: [], trend: 'neutral' };
      this.fetchHistoricalData(symbol, tf);
      // Periyodik tazeleme (60s)
      const id = setInterval(() => this.fetchRealtimeData(symbol, tf), 60000);
      this.timers.push(id);
    }
  }

  cleanup() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  async fetchHistoricalData(symbol, tf) {
    try {
      const res = await fetch(
        `${CONFIG.exchange.binanceRest}/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=100`,
        { signal: AbortSignal.timeout(8000) }
      );
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error('yanıt geçersiz');
      this.data[tf].candles = raw.map((d) => ({
        time: d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5]
      }));
      this.calculateIndicators(tf);
    } catch (e) {
      Logger.debug('MTF', `${tf} geçmiş hatası:`, e.message);
    }
  }

  async fetchRealtimeData(symbol, tf) {
    // Son mumu tazele
    try {
      const res = await fetch(
        `${CONFIG.exchange.binanceRest}/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=2`,
        { signal: AbortSignal.timeout(8000) }
      );
      const raw = await res.json();
      if (!Array.isArray(raw) || !raw.length) return;
      const last = raw[raw.length - 1];
      const candle = { time: last[0], open: +last[1], high: +last[2], low: +last[3], close: +last[4], volume: +last[5] };
      const arr = this.data[tf].candles;
      if (arr.length && arr[arr.length - 1].time === candle.time) arr[arr.length - 1] = candle;
      else arr.push(candle);
      if (arr.length > 100) arr.shift();
      this.calculateIndicators(tf);
    } catch (e) {
      Logger.debug('MTF', `${tf} canlı hatası:`, e.message);
    }
  }

  calculateIndicators(timeframe) {
    const candles = this.data[timeframe]?.candles;
    if (!candles || candles.length < 25) return;
    const closes = candles.map((c) => c.close);
    const e = ema(closes, 20);
    const last = closes.at(-1);
    const emaVal = e.at(-1);
    if (emaVal === null || emaVal === undefined) return;

    if (Math.abs(last - emaVal) / emaVal < 0.001) this.data[timeframe].trend = 'neutral';
    else this.data[timeframe].trend = last > emaVal ? 'up' : 'down';
  }

  /** Trend: 'up' | 'down' | 'neutral' | 'unknown' */
  getTrend(timeframe) {
    return this.data[timeframe]?.trend || 'unknown';
  }

  getSummary() {
    return Object.entries(this.data)
      .map(([tf, d]) => `${tf}:${(d.trend || '?')[0].toUpperCase()}`)
      .join(' ');
  }
}

export default MultiTimeframeManager;
