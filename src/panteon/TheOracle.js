/**
 * TheOracle — Mahşerin Dört Atlısı (piyasa rejimi tespiti)
 * Kaynak: UTC v2.0 §14
 *
 *  SAVAŞ  → ATR% > %2 (agresif)
 *  KITLIK → Hacim < volSMA × 0.6 (temkinli)
 *  SALGIN → Mum düşüşü ≥ %1.5 (sinyaller DURUR!)
 *  ÖLÜM   → ADX < 18 (sessizlik)
 *
 * Süvari aktivasyonu: SAVAŞ→Phoenix, SALGIN→BlackSwan, ÖLÜM/SAVAŞ→Phoenix
 */
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { atr } from '../indicators/ATR.js';
import { adx } from '../indicators/ADX.js';
import { sma } from '../indicators/SMA.js';
import { Logger } from '../core/Logger.js';

export class TheOracle {
  constructor(bot) {
    this.bot = bot;
    this.horseman = null;
  }

  /** Periyodik (7s) tespit */
  detect() {
    const candles = this.bot.candles;
    if (!candles || candles.length < 30) return null;
    const last = candles.at(-1);
    const o = CONFIG.oracle;

    const atrArr = atr(candles, 14);
    const atrPct = (atrArr.at(-1) ?? 0) / last.close;

    const vols = candles.slice(-20).map((c) => c.volume || 0);
    const volSma20 = sma(vols, 20).at(-1) || 1;
    const volThin = last.volume < volSma20 * o.famineVolFactor;

    const dropPct = (last.close - last.open) / last.open;

    const adxArr = adx(candles, 14);
    const adxVal = adxArr.at(-1) ?? 25;

    let horseman = null;
    if (atrPct > o.warAtrPct) horseman = 'SAVAŞ';
    else if (volThin) horseman = 'KITLIK';
    else if (dropPct <= o.plagueDropPct) horseman = 'SALGIN';
    else if (adxVal < o.deathTrendAdx) horseman = 'ÖLÜM';

    if (horseman && horseman !== this.horseman) {
      Logger.info('Oracle', `ATLI: ${horseman} (ATR% ${(atrPct * 100).toFixed(2)}, ADX ${adxVal.toFixed(0)})`);
      this.horseman = horseman;
      STATE.horseman = horseman;
      this.bot.onHorsemanChange?.(horseman);
    } else if (!horseman) {
      this.horseman = null;
      STATE.horseman = null;
    }
    return this.horseman;
  }

  /** Atlıya göre eşik offset'i */
  getThresholdOffset() {
    switch (this.horseman) {
      case 'SAVAŞ': return -0.4;   // agresif
      case 'KITLIK': return 0.5;   // temkinli
      case 'SALGIN': return 5.0;   // sinyalleri durdur!
      case 'ÖLÜM': return 0.6;
      default: return 0;
    }
  }

  /** Süvariler aktif mi? */
  isPhoenixActive() {
    return this.horseman === 'ÖLÜM' || this.horseman === 'SAVAŞ';
  }

  isBlackSwanActive() {
    return this.horseman === 'SALGIN';
  }

  reset() {
    this.horseman = null;
  }
}

export default TheOracle;
