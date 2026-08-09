/**
 * BreakoutPatternStrategy — Aralık kırılımı
 * Kaynak: UTC v2.0 §5.2
 * 30 mumluk range kırılımı + hacim > volSMA20 × 1.4 → trend devamı.
 */
import { Strategy } from './Strategy.js';
import { sma } from '../indicators/SMA.js';

export class BreakoutPatternStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'breakoutPattern', 'uriel', 'courage');
    this.LOOKBACK = 30;
    this.VOL_SPIKE = 1.4;
    this.BREAK_PCT = 0.03 / 100;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.LOOKBACK + 20) return;
    const last = candles.at(-1);
    if (!last) return;

    const slice = candles.slice(-this.LOOKBACK);
    const rangeHigh = Math.max(...slice.map((c) => c.high));
    const rangeLow = Math.min(...slice.map((c) => c.low));

    const vols = candles.slice(-20).map((c) => c.volume || 0);
    const volSma20 = sma(vols, 20).at(-1) || 1;

    const volOk = last.volume > volSma20 * this.VOL_SPIKE;
    const breakPct = this.BREAK_PCT * last.close;

    if (last.close > rangeHigh + breakPct && volOk) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Breakout: ${last.close.toFixed(2)} > ${rangeHigh.toFixed(2)} + hacim`, 4);
    } else if (last.close < rangeLow - breakPct && volOk) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Breakdown: ${last.close.toFixed(2)} < ${rangeLow.toFixed(2)} + hacim`, 4);
    }
  }
}

export default BreakoutPatternStrategy;
