/**
 * MarketStructureStrategy — BOS (Break of Structure)
 * Kaynak: UTC v2.0 §5.2
 * Pivot tespiti (swing=3); fiyat son pivot kırınca → yapı değişimi.
 */
import { Strategy } from './Strategy.js';

export class MarketStructureStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'marketStructure', 'uriel', 'courage');
    this.SWING = 3;
    this.lastPivotHigh = 0;
    this.lastPivotLow = Infinity;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.SWING * 2 + 5) return;
    const price = this.bot.marketData.price;
    if (!price) return;
    const s = this.SWING;
    const c = candles[candles.length - s - 1];

    // Pivot tespiti
    const isPH = c.high > Math.max(...candles.slice(-s * 2 - 1, -1).map((x) => x.high));
    const isPL = c.low < Math.min(...candles.slice(-s * 2 - 1, -1).map((x) => x.low));

    if (isPH) this.lastPivotHigh = c.high;
    if (isPL) this.lastPivotLow = c.low;

    if (this.lastPivotHigh && price > this.lastPivotHigh) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `BOS: ${price.toFixed(2)} > pivot ${this.lastPivotHigh.toFixed(2)}`, 4);
    }
    if (this.lastPivotLow !== Infinity && price < this.lastPivotLow) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `BOS: ${price.toFixed(2)} < pivot ${this.lastPivotLow.toFixed(2)}`, 4);
    }
  }
}

export default MarketStructureStrategy;
