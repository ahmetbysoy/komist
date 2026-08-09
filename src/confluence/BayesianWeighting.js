/**
 * BayesianWeighting — Beta-Binomial strateji ağırlıklandırma + oto-toggle
 * Kaynak: UTC v2.0 §10-11
 *
 * Posterior ortalama: mean = α/(α+β)
 * Belirsizlik cezası: totalObs < 10 → 0.5 + totalObs/20, aksi 1.0
 * w = clamp((0.5 + mean) × penalty × groupBoost, 0.3, 2.0)
 */
import { STATE } from '../core/State.js';
import { STRATEGY_GROUPS } from '../strategies/index.js';
import { clamp } from '../core/Utils.js';

export class BayesianWeighting {
  constructor(bot) {
    this.bot = bot;
    this.lastAutoToggleTs = 0;
  }

  /**
   * Bir stratejinin ağırlığını hesapla.
   * @param {string} strategyKey
   * @param {string} regime 'overall' | 'trend' | 'range' | 'transition'
   */
  getWeight(strategyKey, regime = 'overall') {
    const stats = STATE.strategyStats[strategyKey]?.[regime] ||
                  STATE.strategyStats[strategyKey]?.overall ||
                  this._ensureDefaultStats(strategyKey);

    const mean = stats.alpha / (stats.alpha + stats.beta || 1);
    const totalObs = stats.alpha + stats.beta;
    const uncertainty = totalObs < 10 ? (0.5 + totalObs / 20) : 1.0;

    let w = (0.5 + mean) * uncertainty;

    // Grup boost (rejim bazlı)
    const groupBoost = this._groupBoost(strategyKey, regime);
    w *= groupBoost;

    return clamp(w, 0.3, 2.0);
  }

  /** Rejim + grup + volatilite boost çarpanı */
  _groupBoost(strategyKey, regime) {
    const inTrend = STRATEGY_GROUPS.trending.includes(strategyKey);
    const inMean = STRATEGY_GROUPS.meanReversion.includes(strategyKey);

    let boost = 1.0;
    if (regime === 'trend' && inTrend) boost *= 1.15;
    if (regime === 'range' && inMean) boost *= 1.15;

    // Volatilite ayarı (yalnız ölçülmüşse)
    const atrPct = STATE.indicators?.atrPct ?? 0;
    if (atrPct > 0) {
      if (atrPct < 0.005) {          // düşük volatilite
        if (inTrend) boost *= 0.9;
        if (inMean) boost *= 1.05;
      } else if (atrPct > 0.02) {    // yüksek volatilite
        if (inTrend) boost *= 1.05;
        if (inMean) boost *= 0.95;
      }
    }
    return boost;
  }

  /** İstatistik yoksa default (α=3, β=2 — Beta-Binomial prior) oluştur */
  _ensureDefaultStats(strategyKey) {
    if (!STATE.strategyStats[strategyKey]) STATE.strategyStats[strategyKey] = {};
    const base = { alpha: 3, beta: 2, proposals: 0, contrib: 0, wins: 0, losses: 0, shadowWins: 0, shadowLosses: 0, shadowProposals: 0, lastUpdate: Date.now() };
    for (const regime of ['overall', 'trend', 'range', 'transition']) {
      if (!STATE.strategyStats[strategyKey][regime]) {
        STATE.strategyStats[strategyKey][regime] = { ...base };
      }
    }
    return STATE.strategyStats[strategyKey].overall;
  }

  /** Result kaydet: TP → α+1, SL → β+1 */
  recordResult(strategyKey, isWin, regime = 'overall') {
    const stats = STATE.strategyStats[strategyKey] || {};
    const target = stats[regime] || stats.overall;
    if (!target) return;
    if (isWin) target.alpha += 1;
    else target.beta += 1;
    target.wins = (target.wins || 0) + (isWin ? 1 : 0);
    target.losses = (target.losses || 0) + (isWin ? 0 : 1);
    this.bot.saveStrategyStats?.();
  }

  /**
   * Oto-toggle: düşük ağırlık + yeterli katkı → shadow ban;
   * gölge WR yüksekse rehabilite et.
   */
  autoToggleStrategies() {
    const opt = this.bot.settings?.optimization;
    if (!opt?.enabled || !opt.autoToggle) return;

    const nowMs = Date.now();
    if (nowMs - this.lastAutoToggleTs < 60000) return;
    this.lastAutoToggleTs = nowMs;

    for (const [key, inst] of Object.entries(STATE.strategies)) {
      const w = this.getWeight(key);
      const stats = STATE.strategyStats[key]?.overall;

      // Shadow ban: zayıf + yeterli deneyim
      if (w < opt.minWeightToStay && (stats?.contrib || 0) >= opt.minContribForToggle && inst._isLive) {
        this.bot.shadowBanStrategy?.(key, w);
      }
      // Rehabilitasyon: gölgede iyi performans
      if (!inst._isLive) {
        const sr = stats?.shadowProposals >= 20
          ? stats.shadowWins / stats.shadowProposals
          : 0;
        if (sr >= 0.58 && nowMs - (stats.lastShadowToggle || 0) > 1800000) {
          this.bot.rehabilitateStrategy?.(key, sr);
        }
      }
    }
  }
}

export default BayesianWeighting;
