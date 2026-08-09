/**
 * PantheonManager — Mitolojik itibar motoru
 * Kaynak: UTC v2.0 §13 + GPTE.HTML
 *
 *  - 5 elçi: Metatron, Uriel, Raphael, Gabriel, Michael
 *  - Reputation: [-100, +100]
 *  - Modlar: İnançlı (rep ≥ 20) / Şüpheci / Kıyamet (rep ≤ -10)
 *  - Mod parametreleri: thresholdDelta, cooldownScale, rrMultiplier
 *  - Fısıltı (whisper): 30dk süreli bias
 *  - Durgunluk cezası: 4 saat işlem yoksa tüm elçilere -1
 */
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { clamp } from '../core/Utils.js';
import { Logger } from '../core/Logger.js';

export const AMBASSADOR_NAMES = ['metatron', 'uriel', 'raphael', 'gabriel', 'michael'];

const MODE_PARAMS = {
  İnançlı: { thresholdDelta: -0.25, cooldownScale: 0.92, rrMultiplier: 1.05 },
  Şüpheci: { thresholdDelta: 0.00, cooldownScale: 1.00, rrMultiplier: 1.00 },
  Kıyamet: { thresholdDelta: 0.40, cooldownScale: 1.12, rrMultiplier: 0.95 }
};

export class PantheonManager {
  constructor(bot) {
    this.bot = bot;
    this.state = {
      ambassadors: Object.fromEntries(AMBASSADOR_NAMES.map((n) => [
        n, { name: n, reputation: 0, mode: 'Şüpheci', tempBonus: 0, lastActive: Date.now() }
      ])),
      missionaries: { spoof: { score: 50 }, cusum: { score: 50 }, mtf: { score: 50 } }
    };
    this.whisper = { bias: 0, until: 0 };
  }

  load(state) {
    if (state) this.state = { ...this.state, ...state };
    this._recalcModes();
  }

  serialize() {
    return this.state;
  }

  getMode(name) {
    return this.state.ambassadors[name]?.mode || 'Şüpheci';
  }

  /** Sinyal sonucu itibar güncelle (TP/SL) */
  onSignalResult(result) {
    const w = CONFIG.panteon.reputationWeights;
    const contributors = result.contributors || [];
    const isWin = result.status === 'tp';

    for (const name of AMBASSADOR_NAMES) {
      const a = this.state.ambassadors[name];
      if (isWin) {
        // TP: katkıda bulunan elçi +1, Raphael her zaman +0.5
        const delta = contributors.includes(name) ? w.tpContributor : 0;
        const raphael = name === 'raphael' ? w.tpRaphael : 0;
        a.reputation = clamp(a.reputation + delta + raphael, -100, 100);
      } else {
        // SL: tümü -2, sorumlu elçi ekstra -3
        a.reputation = clamp(a.reputation + w.slAll, -100, 100);
        if (contributors[0] === name) {
          a.reputation = clamp(a.reputation + w.slResponsibleExtra, -100, 100);
        }
      }
      a.lastActive = Date.now();
    }
    this._recalcModes();
    this.bot.savePanteonState?.();
    this.bot.onReputationChange?.();
  }

  /** Durgunluk: 4 saat işlem yok → tümü -1 */
  checkInactivity() {
    const hours = CONFIG.panteon.dormancyHours;
    const nowMs = Date.now();
    let changed = false;
    for (const name of AMBASSADOR_NAMES) {
      const a = this.state.ambassadors[name];
      if (nowMs - a.lastActive > hours * 3600000) {
        a.reputation = clamp(a.reputation + CONFIG.panteon.reputationWeights.dormancyPenalty, -100, 100);
        changed = true;
      }
    }
    if (changed) {
      this._recalcModes();
      this.bot.savePanteonState?.();
    }
  }

  /** Fısıltı: 30dk süreli yön biası */
  applyProphecy(prophecy) {
    // DEFENSIVE / AGGRESSIVE / NEUTRAL
    this.whisper.bias = prophecy === 'DEFENSIVE' ? -0.2
      : prophecy === 'AGGRESSIVE' ? 0.2 : 0;
    this.whisper.until = Date.now() + CONFIG.panteon.whisperTtlMs;
    this.bot.savePanteonState?.();
  }

  getWhisperBias() {
    if (Date.now() > this.whisper.until) return 0;
    return this.whisper.bias;
  }

  /** Mood modları → sistem parametrelerine çevir */
  _combinedThresholdDelta() {
    const sum = AMBASSADOR_NAMES.reduce((s, n) =>
      s + (MODE_PARAMS[this.state.ambassadors[n].mode]?.thresholdDelta ?? 0), 0);
    return clamp(sum + this.getWhisperBias(), -1.0, 1.0);
  }

  getCooldownScale() {
    return AMBASSADOR_NAMES.reduce((p, n) =>
      p * (MODE_PARAMS[this.state.ambassadors[n].mode]?.cooldownScale ?? 1), 1);
  }

  getRRMultiplier() {
    return AMBASSADOR_NAMES.reduce((p, n) =>
      p * (MODE_PARAMS[this.state.ambassadors[n].mode]?.rrMultiplier ?? 1), 1);
  }

  _recalcModes() {
    const { inanc, kiyamet } = CONFIG.panteon.modeThresholds;
    for (const name of AMBASSADOR_NAMES) {
      const a = this.state.ambassadors[name];
      a.mode = a.reputation >= inanc ? 'İnançlı'
        : a.reputation <= kiyamet ? 'Kıyamet' : 'Şüpheci';
    }
  }

  getAmbassadorList() {
    return AMBASSADOR_NAMES.map((n) => ({
      name: n,
      reputation: this.state.ambassadors[n].reputation,
      mode: this.state.ambassadors[n].mode
    }));
  }
}

export default PantheonManager;
export { MODE_PARAMS };
