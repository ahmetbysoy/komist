/**
 * VelocityScalpingStrategy — Fiyat hızı skalpi
 * Kaynak: UTC v2.0 §5.2
 * 2s pencere, 20+ nokta; |Δprice/price| > %0.1 → momentum yönünde.
 */
import { Strategy } from './Strategy.js';
import { pushCap } from '../core/Utils.js';

export class VelocityScalpingStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'velocityScalping', 'uriel', 'courage');
    this.pricePoints = [];
    this.VELOCITY_WINDOW_MS = 2000;
    this.MIN_POINTS = 20;
    this.VELOCITY_THRESHOLD_PERCENT = 0.10 / 100;
  }

  processTrade(trade) {
    pushCap(this.pricePoints, { price: trade.price, ts: trade.ts || Date.now() }, 200);
    if (this.pricePoints.length < this.MIN_POINTS) return;

    const cutoff = Date.now() - this.VELOCITY_WINDOW_MS;
    const recent = this.pricePoints.filter((p) => p.ts >= cutoff);
    if (recent.length < this.MIN_POINTS) return;

    const first = recent[0].price;
    const last = recent[recent.length - 1].price;
    const delta = (last - first) / first;

    if (Math.abs(delta) > this.VELOCITY_THRESHOLD_PERCENT) {
      this.propose(this.bot.marketData.symbol,
        delta > 0 ? 'buy' : 'sell',
        `Fiyat hızı: %${(delta * 100).toFixed(3)}/2s`, 4);
    }
  }
}

export default VelocityScalpingStrategy;
