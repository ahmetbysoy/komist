/**
 * PantheonManager — Mitolojik itibar motoru (barva35.html referansı)
 * 3 elçi: Metatron (bilgelik), Uriel (cesaret), Raphael (şifa)
 *
 * İtibar güncelleme (barva35):
 *  TP → katkıda bulunan elçi +3, Raphael her zaman +1
 *  SL → tüm elçiler -1, katkıda bulunan elçi ekstra -2
 * Modlar: rep ≥ 80 → İNANÇLI, ≥ 50 → ŞÜPHECİ, < 50 → KIYAMET
 * Kehanet (prophecy): DEFENSIVE/AGGRESSIVE/NEUTRAL → tempBonus
 * Durgunluk: 4 saat işlem yok → tüm elçilere -1
 */
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export const ELCI_NAMES = ['metatron', 'uriel', 'raphael', 'gabriel', 'michael'];

const MODE_WEIGHTS = {
  İNANÇLI: { thresholdDelta: -0.25, cooldownScale: 0.92, rrMultiplier: 1.05 },
  ŞÜPHECİ: { thresholdDelta: 0.00, cooldownScale: 1.00, rrMultiplier: 1.00 },
  KIYAMET: { thresholdDelta: 0.40, cooldownScale: 1.12, rrMultiplier: 0.95 }
};

export class PantheonManager {
  constructor(bot) {
    this.bot = bot;
    this.elciler = {
      metatron: { name: 'Metatron', reputation: 100, mode: 'İNANÇLI', tempBonus: 0 },
      uriel: { name: 'Uriel', reputation: 100, mode: 'İNANÇLI', tempBonus: 0 },
      raphael: { name: 'Raphael', reputation: 100, mode: 'İNANÇLI', tempBonus: 0 },
      gabriel: { name: 'Gabriel', reputation: 100, mode: 'İNANÇLI', tempBonus: 0 },
      michael: { name: 'Michael', reputation: 100, mode: 'İNANÇLI', tempBonus: 0 }
    };
    this.lastActivityTimestamp = Date.now();
  }

  /** Strateji → elçi eşlemesi (bot.strategyAmbassadors) */
  getStrategyAmbassador(strategyKey) {
    return this.bot.strategyAmbassadors?.[strategyKey]?.ambassador ?? null;
  }

  /** Sinyal sonucu → itibar (barva35 updateReputation) */
  updateReputation(signalResult) {
    this.lastActivityTimestamp = Date.now();
    const contributingElci = this.getStrategyAmbassador(signalResult.strategy);

    if (signalResult.outcome === 'tp') {
      if (contributingElci && this.elciler[contributingElci]) {
        this.elciler[contributingElci].reputation += 3;
      }
      this.elciler.raphael.reputation += 1;   // Şifacı her zaman küçük bonus
      Logger.info('Panteon', `TP → ${contributingElci || '?'} +3, Raphael +1`);
    } else if (signalResult.outcome === 'sl') {
      for (const key of ELCI_NAMES) this.elciler[key].reputation -= 1;
      if (contributingElci && this.elciler[contributingElci]) {
        this.elciler[contributingElci].reputation -= 2;
      }
      Logger.info('Panteon', `SL → tümü -1, ${contributingElci || '?'} ekstra -2`);
    }

    // Clamp [0, 150]
    const { min, max } = CONFIG.defaultSettings.panteon.reputationBounds;
    for (const key of ELCI_NAMES) {
      this.elciler[key].reputation = Math.max(min, Math.min(max, this.elciler[key].reputation));
    }

    this.updateAllModes();
    this.bot.savePanteonState?.();
    this.bot.updatePanteonUI?.();
  }

  /** Mod hesaplama (barva35 updateAllModes) */
  updateAllModes() {
    for (const key of ELCI_NAMES) {
      const elci = this.elciler[key];
      const total = Math.max(0, elci.reputation + elci.tempBonus);
      if (total >= 80) elci.mode = 'İNANÇLI';
      else if (total >= 50) elci.mode = 'ŞÜPHECİ';
      else elci.mode = 'KIYAMET';
    }
  }

  /** Kehanet uygula (barva35 applyProphecy) — tempBonus ayarlar */
  applyProphecy(prophecy) {
    // DEFENSIVE / AGGRESSIVE / NEUTRAL
    const bonus = prophecy === 'DEFENSIVE' ? 10 : prophecy === 'AGGRESSIVE' ? -10 : 0;
    for (const key of ELCI_NAMES) this.elciler[key].tempBonus = bonus;
    this.updateAllModes();
    this.bot.savePanteonState?.();
    this.bot.updatePanteonUI?.();
    Logger.info('Panteon', `Kehanet: ${prophecy} (tempBonus ${bonus})`);
  }

  /** Durgunluk: 4 saat işlem yok → tümü -1 (barva35 checkInactivity) */
  checkInactivity() {
    const hours = CONFIG.defaultSettings.panteon.dormancyHours;
    if (Date.now() - this.lastActivityTimestamp > hours * 3600000) {
      for (const key of ELCI_NAMES) this.elciler[key].reputation -= 1;
      this.updateAllModes();
      this.bot.savePanteonState?.();
      this.bot.updatePanteonUI?.();
      Logger.info('Panteon', `${hours} saat durgunluk — tüm elçiler -1`);
    }
  }

  getElciMode(name) {
    return this.elciler[name]?.mode ?? 'ŞÜPHECİ';
  }

  /** Mod çarpanları (Confluence eşik için) */
  getThresholdDelta() {
    return ELCI_NAMES.reduce((s, k) => s + (MODE_WEIGHTS[this.elciler[k].mode]?.thresholdDelta ?? 0), 0);
  }

  getCooldownScale() {
    return ELCI_NAMES.reduce((p, k) => p * (MODE_WEIGHTS[this.elciler[k].mode]?.cooldownScale ?? 1), 1);
  }

  getRRMultiplier() {
    return ELCI_NAMES.reduce((p, k) => p * (MODE_WEIGHTS[this.elciler[k].mode]?.rrMultiplier ?? 1), 1);
  }

  getElciler() {
    return ELCI_NAMES.map((k) => ({ ...this.elciler[k], key: k }));
  }

  loadState(state) {
    if (state?.elciler) {
      this.elciler = { ...this.elciler, ...state.elciler };
      this.lastActivityTimestamp = state.lastActivityTimestamp || Date.now();
    }
    this.updateAllModes();
  }

  serialize() {
    return {
      elciler: this.elciler,
      lastActivityTimestamp: this.lastActivityTimestamp
    };
  }
}

export default PantheonManager;
