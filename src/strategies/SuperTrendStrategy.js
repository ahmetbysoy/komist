/**
 * SuperTrendStrategy — SuperTrend flip takibi
 * Kaynak: UTC v2.0 (bara2 strateji)
 * SuperTrend yönü flip edince trend değişimi sinyali.
 */
import { Strategy } from './Strategy.js';
import { superTrend } from '../indicators/SuperTrend.js';

export class SuperTrendStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'superTrend', 'gabriel', 'communication');
    this.PERIOD = 14;
    this.MULT = 3.0;
    this.lastTrend = 0;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.PERIOD * 2 + 2) return;

    const { trend } = superTrend(candles, this.PERIOD, this.MULT);
    const cur = trend.at(-1);
    const prev = trend.at(-2);
    if (cur === null || prev === null) return;

    if (this.lastTrend !== 0 && cur !== prev) {
      if (cur === 1) {
        this.propose(this.bot.marketData.symbol, 'buy',
          `SuperTrend bullish flip @ ${candles.at(-1).close.toFixed(2)}`, 3);
      } else {
        this.propose(this.bot.marketData.symbol, 'sell',
          `SuperTrend bearish flip @ ${candles.at(-1).close.toFixed(2)}`, 3);
      }
    }
    this.lastTrend = cur;
  }
}

export default SuperTrendStrategy;
