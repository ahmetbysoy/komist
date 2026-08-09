/**
 * MultiTimeframeManager — Çoklu zaman dilimi doğrulama
 * Kaynak: UTC v2.0 §4.10
 * REST klines ile MTF mumlarını çeker, EMA trendi belirler,
 * bilgelik (wisdom) skoru hesaplar (GPTE bilgelik faktörü).
 */
import { CONFIG } from '../core/Config.js';
import { ema } from '../indicators/EMA.js';
import { Logger } from '../core/Logger.js';

const TIMEFRAMES = ['1m', '5m', '15m', '1h'];
const TF_MS = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000 };

export class MultiTimeframeManager {
  constructor(bot) {
    this.bot = bot;
    this.data = {};
    this.timers = [];
  }

  async initialize(symbol) {
    this.cleanup();
    for (const tf of TIMEFRAMES) {
      this.data[tf] = { candles: [], trend: 'neutral', wisdom: 50 };
      this._fetch(symbol, tf);
      // Periyodik tazeleme
      this.timers.push(setInterval(() => this._fetch(symbol, tf), 60000));
    }
  }

  cleanup() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  async _fetch(symbol, tf) {
    try {
      const res = await fetch(
        `${CONFIG.exchange.binanceRest}/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=100`,
        { signal: AbortSignal.timeout(8000) }
      );
      const raw = await res.json();
      this.data[tf].candles = raw.map((d) => ({
        time: d[0],
        open: +d[1], high: +d[2], low: +d[3], close: +d[4],
        volume: +d[5]
      }));
      this._calcIndicators(tf);
    } catch (e) {
      Logger.debug('MTF', `${tf} veri hatası:`, e.message);
    }
  }

  _calcIndicators(tf) {
    const candles = this.data[tf].candles;
    if (candles.length < 25) return;
    const closes = candles.map((c) => c.close);
    const e = ema(closes, 20);
    const last = closes.at(-1);
    const emaVal = e.at(-1);
    if (emaVal === null) return;

    if (Math.abs(last - emaVal) / emaVal < 0.001) this.data[tf].trend = 'neutral';
    else this.data[tf].trend = last > emaVal ? 'up' : 'down';

    // Bilgelik: MTF uyumu
    const upCount = TIMEFRAMES.filter((t) => this.data[t]?.trend === 'up').length;
    const downCount = TIMEFRAMES.filter((t) => this.data[t]?.trend === 'down').length;
    this.data[tf].wisdom = Math.round(50 + (upCount - downCount) * 15);
  }

  /** GPTE bilgelik faktörü: f = 0.45 + 0.45×(1 - w/100) */
  getWisdomFactor(tf = '15m') {
    const w = this.data[tf]?.wisdom ?? 50;
    return 0.45 + 0.45 * (1 - w / 100);
  }

  /** MTF uyumuna göre skoru ölçekle (trend yönüne) */
  applyWisdom(direction, score) {
    const up = this.data['15m']?.trend === 'up';
    const down = this.data['15m']?.trend === 'down';
    if (direction === 'buy' && down) return score * this.getWisdomFactor();
    if (direction === 'sell' && up) return score * this.getWisdomFactor();
    return score;
  }

  getTrendSummary() {
    return TIMEFRAMES.map((tf) => `${tf}:${this.data[tf]?.trend?.[0] ?? '?'}`).join(' ');
  }
}

export default MultiTimeframeManager;
