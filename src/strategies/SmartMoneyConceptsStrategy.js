/**
 * SmartMoneyConceptsStrategy — FVG / Order Block tespiti
 * Kaynak: UTC v2.0 §5.4
 * 3 mumluk fair value gap (FVG) ve order block kırılımı.
 */
import { Strategy } from './Strategy.js';

export class SmartMoneyConceptsStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'smartMoneyConcepts', 'gabriel', 'communication');
    this.GAP_MIN_PCT = 0.05 / 100;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < 10) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    const last = candles.at(-1);

    // FVG: mum i-1'in low'u > mum i+1'in high'u (bullish gap)
    for (let i = candles.length - 6; i < candles.length - 1; i++) {
      const a = candles[i - 1], b = candles[i + 1];
      if (!a || !b) continue;

      const bullGap = a.low - b.high;
      const bearGap = b.low - a.high;
      const gapPctBull = bullGap / price;
      const gapPctBear = bearGap / price;

      if (bullGap > 0 && gapPctBull > this.GAP_MIN_PCT && last.close > a.high) {
        this.propose(this.bot.marketData.symbol, 'buy',
          `Bullish FVG dolduruldu: ${a.low.toFixed(2)}-${b.high.toFixed(2)}`, 3);
        return;
      }
      if (bearGap > 0 && gapPctBear > this.GAP_MIN_PCT && last.close < b.low) {
        this.propose(this.bot.marketData.symbol, 'sell',
          `Bearish FVG dolduruldu: ${b.low.toFixed(2)}-${a.high.toFixed(2)}`, 3);
        return;
      }
    }
  }
}

export default SmartMoneyConceptsStrategy;
