/**
 * PositionManager — TP/SL hesaplama, breakeven, trailing stop
 * Kaynak: UTC v2.0 §6.4-6.5
 *
 *  - ATR bazlı mesafe: atrMultiplier = 1.5 - (min(10,score)/20)
 *  - RR çarpanları: elçi modu, rejim, skor bonusu
 *  - Breakeven: MFE ≥ 0.8R → SL = entry
 *  - Trailing: MFE ≥ 1.5R → SL = current ± ATR×0.5
 */
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { atr } from '../indicators/ATR.js';

export class PositionManager {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Sinyal için TP/SL seviyelerini hesapla.
   * @returns {{tp, sl, rr, distance}|null}
   */
  calculateLevels(direction, price, score) {
    if (!price) return null;

    // ATR
    const candles = this.bot.candles;
    let atrVal = price * 0.0015;   // fallback
    if (candles?.length >= 15) {
      const arr = atr(candles, CONFIG.tpSl.atrPeriod);
      const v = arr.at(-1);
      if (v) atrVal = v;
    }

    // ATR multiplier: score 0 → 1.5, score 10 → 1.0
    const atrMult = 1.5 - (Math.min(10, score) / 20);
    const slDist = atrVal * atrMult;

    // RR çarpanı
    let rr = CONFIG.tpSl.rrRatioBase;
    const modeMult = this.bot.getModeRRMultiplier?.() ?? 1.0;
    rr *= modeMult;
    if (STATE.marketRegime === 'trend') rr *= 1.1;
    if (STATE.marketRegime === 'range') rr *= 0.95;
    rr *= 1 + Math.min(0.3, score / 10);

    const tpDist = slDist * rr;

    if (direction === 'buy') {
      return { tp: price + tpDist, sl: price - slDist, rr, distance: slDist };
    }
    return { tp: price - tpDist, sl: price + slDist, rr, distance: slDist };
  }

  /**
   * Breakeven + trailing stop güncellemesi (pozisyon bazlı).
   * @param {object} pos { dir, entry, stop, mfeR }
   * @param {number} currentPrice
   */
  updateStop(pos, currentPrice) {
    if (!pos || !pos.entry) return pos.stop;

    const risk = Math.abs(pos.entry - pos.stop) || 1;
    const rNow = pos.dir === 'buy'
      ? (currentPrice - pos.entry) / risk
      : (pos.entry - currentPrice) / risk;
    pos.mfeR = Math.max(pos.mfeR || 0, rNow);

    const be = CONFIG.tpSl.breakeven;
    const tr = CONFIG.tpSl.trailing;
    if (!be.enabled && !tr.enabled) return pos.stop;

    let stop = pos.stop;
    // Breakeven
    if (be.enabled && pos.mfeR >= be.beAtR) {
      stop = pos.dir === 'buy' ? Math.max(stop, pos.entry) : Math.min(stop, pos.entry);
    }
    // Trailing (yalnız iyileştiriyorsa)
    if (tr.enabled && pos.mfeR >= tr.trailAfterR) {
      const trail = this._currentAtr() * 0.5;
      const candidate = pos.dir === 'buy'
        ? currentPrice - trail
        : currentPrice + trail;
      stop = pos.dir === 'buy' ? Math.max(stop, candidate) : Math.min(stop, candidate);
    }
    return stop;
  }

  _currentAtr() {
    const candles = this.bot.candles;
    if (candles?.length >= 15) {
      const v = atr(candles, CONFIG.tpSl.atrPeriod).at(-1);
      if (v) return v;
    }
    return (STATE.lastPrice || 1) * 0.0015;
  }
}

export default PositionManager;
