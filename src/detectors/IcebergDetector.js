/**
 * IcebergDetector — Gizli likidite (iceberg) tespiti
 * Kaynak: BOZOK PRO §7.4
 *
 * Son 80 trade'in bir fiyat seviyesindeki toplam notional'ı,
 * book'taki aynı seviyenin notional'ının 2 katından büyükse
 * ve book'ta qty > 0 ise → iceberg sinyali.
 */
import { STATE } from '../core/State.js';
import { now, fmtPrice } from '../core/Utils.js';

export class IcebergDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const recentTrades = STATE.trades.slice(-80);
    if (recentTrades.length < 10) return;

    const levels = new Map();
    for (const t of recentTrades) {
      const k = t.price.toFixed(2);
      if (!levels.has(k)) levels.set(k, { price: t.price, tradeNotional: 0, count: 0 });
      const x = levels.get(k);
      x.tradeNotional += t.notional;
      x.count += 1;
    }

    for (const [k, x] of levels) {
      const depthAt = [...STATE.book.bids, ...STATE.book.asks]
        .find((l) => l.price.toFixed(2) === k);
      if (!depthAt || depthAt.qty <= 0) continue;

      if (x.tradeNotional > depthAt.notional * 2) {
        if (!STATE.detectorState.icebergZones.find((z) => z.key === k)) {
          STATE.detectorState.icebergZones.push({
            key: k,
            price: x.price,
            firstSeen: now(),
            score: x.tradeNotional / (depthAt.notional || 1)
          });
          this.bus.emit('signal:add', {
            type: 'ICEBERG_ORDER',
            bias: 'bullish',
            confidence: 78,
            description: `Iceberg benzeri hidden liquidity @ ${fmtPrice(x.price)}`,
            price: x.price,
            zone: { price: x.price },
            evidence: { tradeNotional: x.tradeNotional, depthNotional: depthAt.notional }
          });
        }
      }
    }
  }
}

export default IcebergDetector;
