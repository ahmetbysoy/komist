/**
 * FibonacciRetracementStrategy — Fibonacci düzeltme seviyeleri
 * Kaynak: UTC v2.0 §5.4
 * Son swing yüksek/düşük arasında %38.2/%50/%61.8 seviyelerine
 * fiyat teması + onay mumu → dönüş.
 */
import { Strategy } from './Strategy.js';

export class FibonacciRetracementStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'fibonacciRetracement', 'metatron', 'wisdom');
    this.LOOKBACK = 120;
    this.TOL = 0.2 / 100;
    this.levels = [0.382, 0.5, 0.618];
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.LOOKBACK) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    const slice = candles.slice(-this.LOOKBACK);
    const swingHigh = Math.max(...slice.map((c) => c.high));
    const swingLow = Math.min(...slice.map((c) => c.low));
    const range = swingHigh - swingLow;
    if (range <= 0) return;

    const last = candles.at(-1);
    for (const lvl of this.levels) {
      const fibPrice = swingHigh - range * lvl;
      const dist = Math.abs(price - fibPrice) / price;
      if (dist < this.TOL) {
        if (last.close > last.open) {
          this.propose(this.bot.marketData.symbol, 'buy',
            `Fib %${(lvl * 100).toFixed(1)} desteği: ${fibPrice.toFixed(2)}`, 3);
        } else {
          this.propose(this.bot.marketData.symbol, 'sell',
            `Fib %${(lvl * 100).toFixed(1)} direnci: ${fibPrice.toFixed(2)}`, 3);
        }
        break;
      }
    }
  }
}

export default FibonacciRetracementStrategy;
