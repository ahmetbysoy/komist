/**
 * SpoofingDetector — Aldatıcı emir (spoof) tespiti
 * Kaynak: BOZOK PRO §7.3
 *
 * Wall 3s içinde oluşmuş, fiyata %0.15'ten yakın,
 * 700ms'dir güncellenmemiş VE persistence < 3 → pull → spoof.
 * Bid spoof çekilirse → bearish, ask spoof → bullish.
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { now, fmtPrice } from '../core/Utils.js';

export class SpoofingDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const nowTs = now();
    // 500ms throttle
    if (nowTs - STATE.detectorState.lastSpoofCheck < 500) return;
    STATE.detectorState.lastSpoofCheck = nowTs;

    const windowMs = CONFIG.spoofWindowSec * 1000;
    const recentWalls = [
      ...STATE.detectorState.walls.bid,
      ...STATE.detectorState.walls.ask
    ].filter((w) => nowTs - w.firstSeen < windowMs);

    for (const w of recentWalls) {
      const priceDist = STATE.lastPrice
        ? Math.abs(w.price - STATE.lastPrice) / STATE.lastPrice
        : 0;
      if (priceDist > 0.0015) continue;

      const pull = nowTs - w.lastSeen > 700 && w.persistence < 3;
      if (pull && w.notional > 50000) {
        this.bus.emit('signal:add', {
          type: 'HIGH_CONFIDENCE_SPOOF',
          bias: w.key.includes('bid') ? 'bearish' : 'bullish',
          confidence: 83,
          description: `Şüpheli spoof duvarı @ ${fmtPrice(w.price)}`,
          price: w.price,
          zone: { price: w.price },
          evidence: { persistence: w.persistence, notional: w.notional }
        });
      }
    }
  }
}

export default SpoofingDetector;
