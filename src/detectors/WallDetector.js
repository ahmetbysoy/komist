/**
 * WallDetector — Güçlü emir (wall) tespiti
 * Kaynak: BOZOK PRO §7.1
 *
 * qty > median(top15) × wallMultiplier → wall adayı
 * Confidence = clamp(55 + min(25, persistence×3) + min(10, ageMs/1000), 55, 95)
 * Sinyal: notional > $100K && confidence ≥ minConfidence
 * 5s görülmeyen wall temizlenir.
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { now, median, clamp, fmtPrice, fmtQty, fmtNotional } from '../core/Utils.js';

export class WallDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const nowTs = now();
    const bids = STATE.book.bids.slice(0, 15);
    const asks = STATE.book.asks.slice(0, 15);
    if (bids.length < 5 || asks.length < 5) return;

    const mult = CONFIG.wallMultiplier;
    const avgBid = median(bids.map((x) => x.qty));
    const avgAsk = median(asks.map((x) => x.qty));

    const scan = (levels, side, avg) => {
      for (const lv of levels) {
        if (lv.qty <= avg * mult) continue;

        const key = lv.price.toFixed(8);
        const list = STATE.detectorState.walls[side];
        let w = list.find((x) => x.key === key);

        if (!w) {
          w = { key, price: lv.price, qty: lv.qty, notional: lv.notional,
                firstSeen: nowTs, lastSeen: nowTs, persistence: 1, hits: 0 };
          list.push(w);
        } else {
          w.qty = lv.qty;
          w.notional = lv.notional;
          w.lastSeen = nowTs;
          w.persistence += 1;
        }

        const ageMs = nowTs - w.firstSeen;
        const confidence = clamp(
          55 + Math.min(25, w.persistence * 3) + Math.min(10, ageMs / 1000),
          55, 95
        );

        if (lv.notional > 100000 && confidence >= CONFIG.minConfidence) {
          this.bus.emit('signal:add', {
            type: side === 'bid' ? 'STRONG_BID_WALL' : 'STRONG_ASK_WALL',
            bias: side === 'bid' ? 'bullish' : 'bearish',
            confidence,
            description: `${side === 'bid' ? 'Güçlü bid wall' : 'Güçlü ask wall'} @ ${fmtPrice(lv.price)} — ${fmtQty(lv.qty)} (${fmtNotional(lv.notional)})`,
            price: lv.price,
            zone: { price: lv.price, side },
            evidence: { qty: lv.qty, notional: lv.notional, persistence: w.persistence, ageMs }
          });
        }
      }
    };

    scan(bids, 'bid', avgBid);
    scan(asks, 'ask', avgAsk);

    // 5s görülmeyenleri temizle
    for (const side of ['bid', 'ask']) {
      STATE.detectorState.walls[side] = STATE.detectorState.walls[side]
        .filter((w) => nowTs - w.lastSeen < 5000);
    }
  }
}

export default WallDetector;
