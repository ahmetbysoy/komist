/**
 * LadderDetector — Merdiven (ladder) yapısı tespiti
 * Kaynak: BOZOK PRO §7.6
 *
 * En az 3 bid wall, ardışık wall arası mesafeler düzenli
 * (|g1-g2|/g1 < 0.3) → birikim (accumulation) sinyali.
 */
import { STATE } from '../core/State.js';
import { clamp } from '../core/Utils.js';

export class LadderDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const walls = STATE.detectorState.walls.bid;
    if (walls.length < 3) return;

    const sorted = [...walls].sort((a, b) => b.price - a.price);
    let ladderCount = 0;

    for (let i = 0; i < sorted.length - 2; i++) {
      const g1 = sorted[i].price - sorted[i + 1].price;
      const g2 = sorted[i + 1].price - sorted[i + 2].price;
      if (g1 > 0 && g2 > 0 && Math.abs(g1 - g2) / g1 < 0.3) {
        ladderCount++;
      }
    }

    if (ladderCount >= 1 && ladderCount > STATE.detectorState.ladderCount) {
      STATE.detectorState.ladderCount = ladderCount;
      this.bus.emit('signal:add', {
        type: 'LADDER_BUILDING',
        bias: 'bullish',
        confidence: clamp(60 + ladderCount * 8, 60, 88),
        description: `Ladder yapısı: ${ladderCount + 2} düzenli bid wall — birikim sinyali`,
        price: sorted[0].price,
        zone: { price: sorted[0].price },
        evidence: { wallCount: ladderCount + 2 }
      });
    }
  }
}

export default LadderDetector;
