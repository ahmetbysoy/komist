/**
 * VWAPReversionStrategy — VWAP dönüşümü
 * Kaynak: UTC v2.0 §5.1
 * |price - VWAP| / VWAP > ATR/price → VWAP'a dönüş beklentisi.
 */
import { Strategy } from './Strategy.js';
import { vwap } from '../indicators/VWAP.js';
import { atr } from '../indicators/ATR.js';

export class VWAPReversionStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'vwapReversion', 'metatron', 'wisdom');
    this.MULT = 1.0;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < 20) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    const vwapArr = vwap(candles);
    const atrArr = atr(candles, 14);
    const currentVwap = vwapArr.at(-1);
    const currentAtr = atrArr.at(-1);
    if (!currentVwap) return;

    const deviation = Math.abs(price - currentVwap) / currentVwap;
    const atrPct = currentAtr ? currentAtr / price : 0;

    if (deviation > atrPct * this.MULT) {
      if (price > currentVwap) {
        this.propose(this.bot.marketData.symbol, 'sell',
          `VWAP üstü sapma: %${(deviation * 100).toFixed(2)}`, 3);
      } else {
        this.propose(this.bot.marketData.symbol, 'buy',
          `VWAP altı sapma: %${(deviation * 100).toFixed(2)}`, 3);
      }
    }
  }
}

export default VWAPReversionStrategy;
