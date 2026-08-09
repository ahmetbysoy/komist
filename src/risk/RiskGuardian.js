/**
 * RiskGuardian — Araf Protokolü (kill switch)
 * Kaynak: UTC v2.0 §20.1
 *
 * Katman 5: total ≥ 10 && WR < %35 → SİSTEM DURDURULUR.
 * Ayrıca genel spread/derinlik gate kontrolü yapar.
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class RiskGuardian {
  constructor(bot) {
    this.bot = bot;
    this.killSwitchActivated = false;
  }

  checkKillSwitch() {
    const perf = STATE.performance;
    const total = perf.trades;
    if (total >= 10 && this.killSwitchActivated === false) {
      const wins = perf.wins;
      const wr = wins / total;
      if (wr < 0.35) {
        this.killSwitchActivated = true;
        Logger.error('RiskGuardian', `Win rate %${(wr * 100).toFixed(0)} — ARAF PROTOKOLÜ AKTİF!`);
        this.bot.onKillSwitch?.();
        return true;
      }
    }
    // Rehabilitasyon: WR düzelirse kill switch kalkar
    if (this.killSwitchActivated && total >= 20) {
      const wr = perf.wins / total;
      if (wr >= 0.4) {
        this.killSwitchActivated = false;
        Logger.info('RiskGuardian', 'Kill switch kaldırıldı (WR düzeldi)');
      }
    }
    return this.killSwitchActivated;
  }

  /** Gating: spread ≤ %0.1 ve derinlik ≥ $50K (UTC §6 gating) */
  checkMarketGate() {
    const g = CONFIG.gating;
    if (!g.enabled) return true;
    const micro = STATE.micro;
    if (!micro || !micro.mid) return false;
    const spreadPct = micro.spread / micro.mid;
    const depthUsd = (micro.depthBid + micro.depthAsk) * micro.mid;
    return spreadPct <= g.spreadMaxPct && depthUsd >= g.minDepthUsd;
  }

  reset() {
    this.killSwitchActivated = false;
  }
}

export default RiskGuardian;
