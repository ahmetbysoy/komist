/**
 * DivergenceDetectionStrategy — Genel divergence dedektörü
 * Kaynak: UTC v2.0 §5.2 (swing bazlı, RSI kullanır)
 * Swing period: 3. Fiyat-RSI zıt hareket → sinyal.
 */
import { Strategy } from './Strategy.js';
import { rsi } from '../indicators/RSI.js';

export class DivergenceDetectionStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'divergenceDetection', 'metatron', 'wisdom');
    this.LOOKBACK = 40;
    this.SWING_PERIOD = 3;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < 20) return;

    const prices = candles.map((c) => c.close);
    const rsiArr = rsi(prices, 14);
    const s = this.SWING_PERIOD;
    const slice = candles.slice(-this.LOOKBACK);

    const highs = [], lows = [];
    for (let i = s; i < slice.length - s; i++) {
      const c = slice[i];
      const isPH = c.high > slice[i - 1].high && c.high > slice[i - 2].high &&
                   c.high > slice[i + 1].high && c.high > slice[i + 2].high;
      const isPL = c.low < slice[i - 1].low && c.low < slice[i - 2].low &&
                   c.low < slice[i + 1].low && c.low < slice[i + 2].low;
      if (isPH) highs.push({ price: c.high, rsi: rsiArr[candles.length - this.LOOKBACK + i] });
      if (isPL) lows.push({ price: c.low, rsi: rsiArr[candles.length - this.LOOKBACK + i] });
    }

    if (highs.length >= 2) {
      const a = highs[highs.length - 2], b = highs[highs.length - 1];
      if (b.price > a.price && b.rsi < a.rsi && b.rsi < 65) {
        this.propose(this.bot.marketData.symbol, 'sell', 'Bearish divergence (swing)', 4);
      }
    }
    if (lows.length >= 2) {
      const a = lows[lows.length - 2], b = lows[lows.length - 1];
      if (b.price < a.price && b.rsi > a.rsi && b.rsi > 35) {
        this.propose(this.bot.marketData.symbol, 'buy', 'Bullish divergence (swing)', 4);
      }
    }
  }
}

export default DivergenceDetectionStrategy;
