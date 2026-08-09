/**
 * ConfluenceEngine — Uyum (uzlaşma) motoru
 * Kaynak: UTC v2.0 §6
 *
 *  - Proposal zaman çürümesi: decay = e^(-ageSec/decaySec); decaySec=3
 *  - Bayes ağırlığı × skor × decay → directional score
 *  - Gating: spread ≤ %0.1, derinlik ≥ $50K
 *  - Cooldown: genel 15s, aynı yön 30s, ters yön 20s
 *  - Histerezis: ters yöne geçiş için ek +2 puan
 *  - Yön marjı: |buy - sell| > dirMargin (0.5)
 *  - minContributors ≥ 2, minGroups ≥ 1
 */
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { Logger } from '../core/Logger.js';
import { STRATEGY_GROUPS } from '../strategies/index.js';

export class ConfluenceEngine {
  constructor(bot) {
    this.bot = bot;
    this.proposals = [];
    this.lastSignalTime = 0;
    this.lastSignalTimeByDirection = {};
    this.lastSignalDirection = null;
    this.cfg = CONFIG.confluence;
  }

  /** Strateji proposal'ı kabul et */
  propose(strategy, direction, reason, score, ambassador) {
    // Proposal çürüme havuzuna ekle
    this.proposals.push({ strategy, direction, reason, score, ambassador, timestamp: Date.now() });
    if (this.proposals.length > 200) this.proposals.shift();
    this._checkConfluence();
  }

  /** Strategy weight (Bayesian) — bot'tan alır */
  getStrategyWeight(strategy) {
    return this.bot.getStrategyWeight?.(strategy) ?? 1.0;
  }

  _computeDirectional(direction) {
    let totalScore = 0;
    const contributors = [];
    const nowMs = Date.now();
    const decaySec = this.cfg.timeDecaySec;

    for (const p of this.proposals) {
      if (p.direction !== direction) continue;
      const ageSec = (nowMs - p.timestamp) / 1000;
      const decay = Math.exp(-ageSec / decaySec);
      const w = this.getStrategyWeight(p.strategy);
      const eff = p.score * w * decay;
      totalScore += eff;
      contributors.push({ strategy: p.strategy, baseScore: p.score, weight: w, effScore: eff, ambassador: p.ambassador });
    }
    return { score: totalScore, contributors };
  }

  _checkConfluence() {
    const nowMs = Date.now();

    // 1. Genel cooldown
    if (nowMs - this.lastSignalTime < this.cfg.signalMs) return;

    // 2. Proposal yaş filtresi
    this.proposals = this.proposals.filter((p) => nowMs - p.timestamp < this.cfg.proposalTimeoutMs);
    if (this.proposals.length === 0) return;

    const buy = this._computeDirectional('buy');
    const sell = this._computeDirectional('sell');

    // 3. Yön marjı
    if (Math.abs(buy.score - sell.score) <= this.cfg.dirMargin) return;

    // 4. Katkıda bulunan / grup sayısı
    const contributors = buy.contributors.length + sell.contributors.length;
    const groups = new Set([
      ...buy.contributors.map((c) => this._groupOf(c.strategy)),
      ...sell.contributors.map((c) => this._groupOf(c.strategy))
    ]);
    if (contributors < this.cfg.minContributors || groups.size < this.cfg.minGroups) return;

    // 5. Histerezis: ters yön geçişi ekstra puan ister
    let direction = buy.score > sell.score ? 'buy' : 'sell';
    const margin = Math.abs(buy.score - sell.score);
    const hysteresis = this.cfg.reverseHysteresisPoints;
    if (this.lastSignalDirection && this.lastSignalDirection !== direction &&
        margin < hysteresis) return;

    // 6. Aynı yön cooldown
    const lastDir = this.lastSignalTimeByDirection[direction] || 0;
    if (nowMs - lastDir < this.cfg.sameDirectionMs) return;

    // 7. Ters yön cooldown
    if (this.lastSignalDirection && this.lastSignalDirection !== direction &&
        nowMs - this.lastSignalTime < this.cfg.oppositeDirectionMs) return;

    // 8. Gating: spread + derinlik
    if (!this._gatePasses()) return;

    // 9. Eşik kontrolü
    if (Math.max(buy.score, sell.score) < this.cfg.threshold) return;

    // ✓ Sinyal üret
    const score = direction === 'buy' ? buy.score : sell.score;
    const reason = this._buildReason(direction);

    this.lastSignalTime = nowMs;
    this.lastSignalTimeByDirection[direction] = nowMs;
    this.lastSignalDirection = direction;

    Logger.info('Confluence', `SİNYAL: ${direction.toUpperCase()} (skor ${score.toFixed(1)}) — ${reason}`);
    this.bot.onConfluenceSignal?.(direction, score, reason, direction === 'buy' ? buy.contributors : sell.contributors);
  }

  _gatePasses() {
    const g = CONFIG.gating;
    if (!g.enabled) return true;

    const micro = STATE.micro;
    const spreadPct = micro?.mid ? micro.spread / micro.mid : 0;
    const depth = (micro?.depthBid || 0) + (micro?.depthAsk || 0);

    if (spreadPct > g.spreadMaxPct) return false;
    if (depth * (STATE.lastPrice || 1) < g.minDepthUsd) return false;
    return true;
  }

  _groupOf(strategy) {
    if (STRATEGY_GROUPS.trending.includes(strategy)) return 'trending';
    if (STRATEGY_GROUPS.meanReversion.includes(strategy)) return 'meanReversion';
    return 'neutral';
  }

  _buildReason(direction) {
    const dir = direction === 'buy' ? 'buy' : 'sell';
    const { contributors } = this._computeDirectional(dir);
    return contributors.slice(0, 3).map((c) => c.strategy).join(' + ');
  }

  /** Kayıtları temizle */
  reset() {
    this.proposals = [];
    this.lastSignalTime = 0;
    this.lastSignalTimeByDirection = {};
    this.lastSignalDirection = null;
  }
}

export default ConfluenceEngine;
