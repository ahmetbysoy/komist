/**
 * LiquidityVoidDetector — Likidite boşluğu (gap) tespiti
 * Kaynak: BOZOK PRO §7.5
 *
 * gap > avgGap × 3 VE qty < median × 0.3 → void
 * Ask boşluğu → bullish (vacuum fill yukarı), Bid boşluğu → bearish.
 */
import { STATE } from '../core/State.js';
import { mean, median, fmtPrice } from '../core/Utils.js';

export class LiquidityVoidDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const bids = STATE.book.bids, asks = STATE.book.asks;
    if (bids.length < 10 || asks.length < 10) return;

    const askGaps = [], bidGaps = [];
    for (let i = 1; i < 10; i++) {
      askGaps.push(asks[i].price - asks[i - 1].price);
      bidGaps.push(bids[i - 1].price - bids[i].price);
    }
    const askAvg = mean(askGaps);
    const bidAvg = mean(bidGaps);

    // Ask tarafı
    for (let i = 1; i < 10; i++) {
      const g = asks[i].price - asks[i - 1].price;
      const qtyBelow = asks[i].qty < median(asks.slice(0, 10).map((a) => a.qty)) * 0.3;
      if (g > askAvg * 3 && qtyBelow) {
        this.bus.emit('signal:add', {
          type: 'LIQUIDITY_VOID_ASK',
          bias: 'bullish',
          confidence: 65,
          description: `Ask likidite boşluğu @ ${fmtPrice(asks[i].price)} — vacuum fill potansiyeli`,
          price: asks[i].price,
          zone: { price: asks[i].price, type: 'void-ask' },
          evidence: { gapSize: g, avgGap: askAvg }
        });
        break;
      }
    }

    // Bid tarafı
    for (let i = 1; i < 10; i++) {
      const g = bids[i - 1].price - bids[i].price;
      const qtyBelow = bids[i].qty < median(bids.slice(0, 10).map((a) => a.qty)) * 0.3;
      if (g > bidAvg * 3 && qtyBelow) {
        this.bus.emit('signal:add', {
          type: 'LIQUIDITY_VOID_BID',
          bias: 'bearish',
          confidence: 65,
          description: `Bid likidite boşluğu @ ${fmtPrice(bids[i].price)} — düşüş hızlanabilir`,
          price: bids[i].price,
          zone: { price: bids[i].price, type: 'void-bid' },
          evidence: { gapSize: g, avgGap: bidAvg }
        });
        break;
      }
    }
  }
}

export default LiquidityVoidDetector;
