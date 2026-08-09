/**
 * VolatilityBreakoutStrategy — Volatilite kırılımı (BB squeeze)
 * Kaynak: UTC v2.0 §5.2
 * BB bandwidth < ATR/price (sıkışma) + hacim patlaması → yön.
 */
import { Strategy } from './Strategy.js';
import { bollinger } from '../indicators/Bollinger.js';
import { atr } from '../indicators/ATR.js';
import { sma } from '../indicators/SMA.js';

export class VolatilityBreakoutStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'volatilityBreakout', 'uriel', 'courage');
    this.BB_PERIOD = 20;
    this.VOL_SPIKE = 1.5;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < 40) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    const closes = candles.map((c) => c.close);
    const bb = bollinger(closes, this.BB_PERIOD);
    const atrArr = atr(candles, 14);

    const up = bb.upper.at(-1), mid = bb.middle.at(-1), low = bb.lower.at(-1);
    const a = atrArr.at(-1);
    if (!up || !mid || !low || !a) return;

    const bandwidth = (up - low) / mid;
    const squeeze = bandwidth < a / price;

    const vols = candles.slice(-20).map((c) => c.volume || 0);
    const volSma20 = sma(vols, 20).at(-1) || 1;
    const lastVol = candles.at(-1).volume || 0;

    if (squeeze && lastVol > volSma20 * this.VOL_SPIKE) {
      this.propose(this.bot.marketData.symbol,
        price > mid ? 'buy' : 'sell',
        `Volatilite kırılımı: BB squeeze + hacim`, 5);
    }
  }
}

export default VolatilityBreakoutStrategy;
