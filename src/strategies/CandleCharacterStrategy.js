/**
 * CandleCharacterStrategy — Mum karakteri (gövde/fitil oranı)
 * Kaynak: UTC v2.0 §5.4
 * Uzun gövde = güç; uzun fitil = red; doji = kararsızlık.
 */
import { Strategy } from './Strategy.js';

export class CandleCharacterStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'candleCharacter', 'michael', 'warfare');
    this.BODY_RATIO = 0.7;      // gövde/range ≥ %70 → güçlü
    this.WICK_RATIO = 0.65;     // fitil/range ≥ %65 → red
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < 3) return;
    const c = candles.at(-1);
    const range = c.high - c.low;
    if (range <= 0) return;

    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Güçlü bullish gövde
    if (body / range > this.BODY_RATIO && c.close > c.open) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Güçlü bullish mum (gövde %${(body / range * 100).toFixed(0)})`, 3);
    }
    // Güçlü bearish gövde
    if (body / range > this.BODY_RATIO && c.close < c.open) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Güçlü bearish mum (gövde %${(body / range * 100).toFixed(0)})`, 3);
    }
    // Uzun alt fitil → alım reddi (bullish)
    if (lowerWick / range > this.WICK_RATIO) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Uzun alt fitil (alım reddi)`, 3);
    }
    // Uzun üst fitil → satım reddi (bearish)
    if (upperWick / range > this.WICK_RATIO) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Uzun üst fitil (satım reddi)`, 3);
    }
  }
}

export default CandleCharacterStrategy;
