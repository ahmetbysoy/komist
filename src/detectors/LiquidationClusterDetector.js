/**
 * LiquidationClusterDetector — Likidasyon kümesi (cascade) tespiti
 * Kaynak: BOZOK PRO §7.9
 *
 * Son 10s'de ≥ 5 likidasyon VE toplam notional > $500K → cluster.
 * Long liq fazlaysa → bearish, short liq fazlaysa → bullish.
 */
import { STATE } from '../core/State.js';
import { now, clamp, fmtNotional } from '../core/Utils.js';

export class LiquidationClusterDetector {
  constructor(bus) {
    this.bus = bus;
  }

  detect() {
    const recent = STATE.liquidations.filter((l) => now() - l.ts < 10000);
    if (recent.length < 5) return;

    const totalNotional = recent.reduce((a, l) => a + l.notional, 0);
    if (totalNotional < 500000) return;

    const longCount = recent.filter((l) => l.side === 'SELL').length;   // Long liq
    const shortCount = recent.filter((l) => l.side === 'BUY').length;   // Short liq

    this.bus.emit('signal:add', {
      type: 'LIQUIDATION_CLUSTER',
      bias: longCount > shortCount ? 'bearish' : 'bullish',
      confidence: clamp(50 + recent.length * 5, 50, 95),
      description: `Likidasyon kümesi: ${recent.length} liq, ${fmtNotional(totalNotional)}`,
      price: STATE.lastPrice,
      zone: { price: STATE.lastPrice },
      evidence: { count: recent.length, notional: totalNotional, longCount, shortCount }
    });
  }
}

export default LiquidationClusterDetector;
