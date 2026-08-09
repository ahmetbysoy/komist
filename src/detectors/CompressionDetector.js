/**
 * CompressionDetector — Sıkışma (compression) bölgesi tespiti
 * Kaynak: BOZOK PRO §7.2
 *
 * Koşullar:
 *  1. Mid'e %1'den yakın bid wall VE ask wall
 *  2. Spread yüzdesi < %0.05
 * OBV = OBI + VPIN (kanıt olarak raporlanır)
 */
import { STATE } from '../core/State.js';

export class CompressionDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const b = STATE.book.bids[0], a = STATE.book.asks[0];
    if (!b || !a) return;

    const spread = a.price - b.price;
    const mid = (a.price + b.price) / 2;
    const spreadPct = (spread / mid) * 100;

    const bidWall = STATE.detectorState.walls.bid.find((w) => (mid - w.price) / mid < 0.01);
    const askWall = STATE.detectorState.walls.ask.find((w) => (w.price - mid) / mid < 0.01);

    const obv = (STATE.micro?.obi || 0) + (STATE.vpin.value || 0);

    if (bidWall && askWall && spreadPct < 0.05) {
      if (!STATE.detectorState.compressionActive) {
        STATE.detectorState.compressionActive = true;
        this.bus.emit('signal:add', {
          type: 'COMPRESSION_ZONE',
          bias: 'warning',
          confidence: 72,
          description: `Sıkışma bölgesi: spread ${spreadPct.toFixed(4)}% — patlama yaklaşıyor`,
          price: mid,
          zone: { price: mid, spreadPct },
          evidence: { spreadPct, obv }
        });
      }
    } else {
      STATE.detectorState.compressionActive = false;
    }
  }
}

export default CompressionDetector;
