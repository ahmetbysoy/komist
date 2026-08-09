/**
 * SupportResistanceStrategy — Destek/Direnç sekmesi
 * Kaynak: UTC v2.0 §5.1
 * Son 60 mumun min/max'ından destek/direnç; fiyat yaklaşınca
 * ve onay mumu gelince (gövde yönü) işlem öner.
 */
import { Strategy } from './Strategy.js';

export class SupportResistanceStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'supportResistance', 'metatron', 'wisdom');
    this.LOOKBACK = 60;
    this.THRESH = 0.15 / 100;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.LOOKBACK + 2) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    const slice = candles.slice(-this.LOOKBACK);
    const support = Math.min(...slice.map((c) => c.low));
    const resistance = Math.max(...slice.map((c) => c.high));
    const last = candles[candles.length - 1];

    // Direnç altına yaklaşma + bearish onay mumu
    if (price > resistance * (1 - this.THRESH) && last.close < last.open) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Direnç: ${resistance.toFixed(2)} reddi`, 3);
    }
    // Destek üstüne yaklaşma + bullish onay mumu
    if (price < support * (1 + this.THRESH) && last.close > last.open) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Destek: ${support.toFixed(2)} tuttu`, 3);
    }
  }
}

export default SupportResistanceStrategy;
