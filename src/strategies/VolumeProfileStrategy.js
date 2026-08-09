/**
 * VolumeProfileStrategy — Hacim profili (POC/VA tespiti)
 * Kaynak: UTC v2.0 §5.4
 * Son PERIOD mumun hacim dağılımı; POC ve fiyat konumu.
 */
import { Strategy } from './Strategy.js';

export class VolumeProfileStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'volumeProfile', 'gabriel', 'communication');
    this.PERIOD = 20;
    this.SPIKE = 2.0;
    this.CLOSE_POS = 0.7;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.PERIOD + 5) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    const slice = candles.slice(-this.PERIOD);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const range = high - low;
    if (range <= 0) return;

    // 10 dilimlik hacim profili
    const buckets = new Array(10).fill(0);
    const avgVol = slice.reduce((s, c) => s + (c.volume || 0), 0) / slice.length;
    for (const c of slice) {
      const idx = Math.min(9, Math.floor(((c.close - low) / range) * 10));
      buckets[idx] += c.volume || 0;
    }

    // POC: en yüksek hacimli dilim
    const pocIdx = buckets.indexOf(Math.max(...buckets));
    const pocPrice = low + (range * (pocIdx + 0.5)) / 10;

    const relPos = (price - low) / range;
    const lastVol = candles.at(-1).volume || 0;

    // Fiyat POC altına sarktı + hacim patlaması → yukarı dönüş
    if (price < pocPrice * 0.998 && lastVol > avgVol * this.SPIKE) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `POC altı: ${pocPrice.toFixed(2)} + hacim patlaması`, 3);
    }
    // Fiyat POC üstünde + aşırı yukarı pozisyon → satış
    if (relPos > this.CLOSE_POS && lastVol > avgVol * this.SPIKE) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Hacim profili üst bölge (%${(relPos * 100).toFixed(0)})`, 3);
    }
  }
}

export default VolumeProfileStrategy;
