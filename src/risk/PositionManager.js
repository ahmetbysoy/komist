/**
 * PositionManager — Dinamik TP/SL + breakeven + trailing stop
 * Kaynak: barva35.html + UTC v2.0 §6.4-6.5
 *
 * TP/SL: ATR bazlı; atrMultiplier = 1.5 - (min(10,score)/20)
 * RR çarpanları: rejim + skor bonusu
 * Breakeven: MFE ≥ beAtR (0.8R) → SL = entry
 * Trailing: MFE ≥ trailAfterR (1.5R) → SL = current ± ATR×0.5
 */
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { atr } from '../indicators/ATR.js';

export class PositionManager {
  constructor(bot) {
    this.bot = bot;
  }

  /** ATR (son değer) — fallback fiyat×0.0015 */
  _currentAtr() {
    const candles = this.bot.candles;
    const period = this.bot.settings?.params?.atrPeriod ?? 14;
    if (candles?.length >= period + 1) {
      const v = atr(candles, period).at(-1);
      if (v) return v;
    }
    return (STATE.marketData.price || 1) * 0.0015;
  }

  /**
   * Sinyal için TP/SL seviyeleri (barva35 calculateDynamicTpSl)
   * @param {'buy'|'sell'} direction
   * @param {number} price
   * @param {number} score  (1-10)
   * @param {string} regime 'trend'|'range'|'transition'
   */
  calculateLevels(direction, price, score, regime = 'transition') {
    if (!price) return null;

    const atrVal = this._currentAtr();
    const atrMult = 1.5 - (Math.min(10, score) / 20);
    const slDist = atrVal * atrMult;

    let rr = this.bot.settings?.params?.rrRatio ?? 1.5;
    // Faz A #12: Panteon RR çarpanı (İNANÇLI 1.05, KIYAMET 0.95) -> TP mesafesini etkiler
    const panteonRR = this.bot.panteon?.getRRMultiplier?.() ?? 1;
    rr *= panteonRR;
    if (regime === 'trend') rr *= 1.1;
    if (regime === 'range') rr *= 0.95;
    rr *= 1 + Math.min(0.3, (score - (this.bot.settings?.confluenceThreshold ?? 3)) / 10);

    const tpDist = slDist * rr;

    if (direction === 'buy') {
      return { tp: price + tpDist, sl: price - slDist, rr, distance: slDist };
    }
    return { tp: price - tpDist, sl: price + slDist, rr, distance: slDist };
  }

  /**
   * @deprecated Faz A #2: Bu metod artık no-op. Pozisyon takibi App.checkAutoCloseSignals() üzerinden signals dizisi ile yapılıyor.
   * Geriye dönük uyum için boş bırakıldı; PositionManager sadece calculateLevels() için kullanılıyor.
   * signals[] TEK kaynak, positions[] ölü sistem kaldırıldı.
   */
  manageOpenPositions() {
    // NO-OP: breakeven/trailing artık App.checkAutoCloseSignals içinde signals üzerinden yönetiliyor
    // Eski positions[] sistemi kullanılmıyor — STATE.positions boş tutuluyor
    return;
  }
}

export default PositionManager;
