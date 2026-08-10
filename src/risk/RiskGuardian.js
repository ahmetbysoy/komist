/**
 * RiskGuardian — Araf Protokolü (kill switch)
 * Kaynak: barva35.html + UTC v2.0 §20
 * Toplam ≥ 10 && WR < eşik (%35) → SİSTEM DURDURULUR (bot.stop()).
 */
import { STATE } from '../core/State.js';
import { Logger } from '../core/Logger.js';

export class RiskGuardian {
  constructor(bot) {
    this.bot = bot;
    this.killSwitchActivated = false;
  }

  checkKillSwitch() {
    const settings = this.bot.settings || {};
    if (!settings.features?.enableRiskGuardian) {
      this.killSwitchActivated = false;
      return false;
    }

    const stats = STATE.stats;
    const total = stats.total;
    if (total < 10) return false;

    const winRate = (stats.tp / total) * 100;
    const threshold = settings.riskGuardian?.killSwitchWinRate ?? 35.0;

    if (winRate < threshold && !this.killSwitchActivated) {
      this.killSwitchActivated = true;
      this.bot.showNotification?.(`!!! ACİL DURDURMA !!! Kazanma oranı %${winRate.toFixed(1)} (eşik %${threshold}). Sistem durduruldu.`, 'danger');
      this.bot.speak?.('Uyarı! Acil durdurma protokolü aktif edildi. Kazanma oranı eşiğin altında. Sistemi acilen kontrol edin.');
      this.bot.stop();
      Logger.error('RiskGuardian', `KILL SWITCH: WR %${winRate.toFixed(1)}`);
      return true;
    }
    return false;
  }

  reset() {
    this.killSwitchActivated = false;
  }
}

export default RiskGuardian;
