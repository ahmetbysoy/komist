/**
 * FlowPatternDetector — Delta Expansion + CVD Divergence
 * Kaynak: BOZOK PRO §7.8
 *
 * 7.8.1 Delta Expansion: |Δ_last| > |Δ_prev| × 2 && activity > $100K
 * 7.8.2 CVD Divergence: fiyat ↑ CVD ↓ → bearish; fiyat ↓ CVD ↑ → bullish
 */
import { STATE } from '../core/State.js';
import { clamp, fmtNotional } from '../core/Utils.js';

export class FlowPatternDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const candles = STATE.flowCandles;
    if (candles.length < 2) return;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    // ── Delta Expansion ──
    if (Math.abs(last.delta) > Math.abs(prev.delta) * 2 && last.activity > 100000) {
      this.bus.emit('signal:add', {
        type: 'FLOW_DELTA_EXPANSION',
        bias: last.delta > 0 ? 'bullish' : 'bearish',
        confidence: clamp(60 + Math.abs(last.pressure) * 0.3, 60, 90),
        description: `Delta genişleme: ${last.delta > 0 ? 'Alım' : 'Satım'} baskısı artıyor (${fmtNotional(Math.abs(last.delta))})`,
        price: STATE.lastPrice,
        zone: { price: STATE.lastPrice },
        evidence: { delta: last.delta, pressure: last.pressure }
      });
    }

    // ── CVD Divergence ──
    if (candles.length >= 5) {
      const cvdSlice = STATE.cvdHistory.slice(-10);
      if (cvdSlice.length >= 5) {
        const priceUp = last.priceClose > candles[candles.length - 5].priceClose;
        const cvdDown = cvdSlice[cvdSlice.length - 1].value < cvdSlice[cvdSlice.length - 5].value;

        if (priceUp && cvdDown) {
          this.bus.emit('signal:add', {
            type: 'CVD_BEARISH_DIVERGENCE',
            bias: 'bearish',
            confidence: 70,
            description: 'CVD bearish divergence: fiyat yükselirken delta düşüyor',
            price: STATE.lastPrice,
            zone: { price: STATE.lastPrice },
            evidence: {}
          });
        } else if (!priceUp && !cvdDown) {
          this.bus.emit('signal:add', {
            type: 'CVD_BULLISH_DIVERGENCE',
            bias: 'bullish',
            confidence: 70,
            description: 'CVD bullish divergence: fiyat düşerken delta yükseliyor',
            price: STATE.lastPrice,
            zone: { price: STATE.lastPrice },
            evidence: {}
          });
        }
      }
    }
  }
}

export default FlowPatternDetector;
