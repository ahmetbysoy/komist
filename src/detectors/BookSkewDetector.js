/**
 * BookSkewDetector — Order book dengesizliği tespiti
 * Kaynak: BOZOK PRO §7.7
 *
 * Skew = (Bid_notional - Ask_notional) / (Bid_notional + Ask_notional)
 * |Skew| > 0.4 → sinyal. Confidence = clamp(50 + |skew|×50, 50, 85).
 */
import { STATE } from '../core/State.js';
import { clamp } from '../core/Utils.js';

export class BookSkewDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const bids = STATE.book.bids.slice(0, 10);
    const asks = STATE.book.asks.slice(0, 10);
    if (bids.length < 10 || asks.length < 10) return;

    const bidNotional = bids.reduce((a, b) => a + b.notional, 0);
    const askNotional = asks.reduce((a, b) => a + b.notional, 0);
    const total = bidNotional + askNotional;
    if (!total) return;

    const skew = (bidNotional - askNotional) / total;

    if (Math.abs(skew) > 0.4) {
      this.bus.emit('signal:add', {
        type: 'BOOK_SKEW',
        bias: skew > 0 ? 'bullish' : 'bearish',
        confidence: clamp(50 + Math.abs(skew) * 50, 50, 85),
        description: `Book skew: ${skew > 0 ? 'Bid' : 'Ask'} ağırlıklı (${(Math.abs(skew) * 100).toFixed(1)}%)`,
        price: STATE.lastPrice,
        zone: { price: STATE.lastPrice },
        evidence: { skew, bidNotional, askNotional }
      });
    }
  }
}

export default BookSkewDetector;
