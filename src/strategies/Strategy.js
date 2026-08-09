/**
 * Strategy — Temel strateji sınıfı
 * Kaynak: UTC v2.0 §4.14 + barva35.html
 *
 * Hook'lar (alt sınıflar override eder):
 *  - analyzeOrderBook(orderBook)  → depth güncellemesinde
 *  - processTrade(trade)          → her trade'de
 *  - periodicAnalyze()            → 5s periyodik
 *
 * propose() zinciri: stat güncelle → shadow kontrol → kill switch
 * → per-strateji cooldown → ConfluenceEngine
 */
import { Logger } from '../core/Logger.js';

export class Strategy {
  constructor(bot, name, ambassador = 'metatron', category = 'wisdom') {
    this.bot = bot;
    this.name = name;
    this.ambassador = ambassador;
    this.category = category;
    this.displayName = this._getDisplayName(name);
    this.lastProposalTime = {};
    this.DEFAULT_PROPOSAL_COOLDOWN_MS = 10000;
    this._isLive = true;
  }

  setIsLive(status) {
    this._isLive = status;
  }

  /** Strateji istatistiklerini başlat (Beta-Binomial priors: α=3, β=2) */
  _ensureStats() {
    const stats = this.bot.strategyStats?.[this.name];
    if (!stats?.overall) {
      const base = { alpha: 3, beta: 2, proposals: 0, contrib: 0, wins: 0, losses: 0, shadowWins: 0, shadowLosses: 0, shadowProposals: 0, lastUpdate: Date.now() };
      this.bot.strategyStats[this.name] = {
        overall: { ...base },
        trend: { ...base },
        range: { ...base },
        transition: { ...base }
      };
      this.bot.saveStrategyStats?.();
    }
    return this.bot.strategyStats[this.name];
  }

  /**
   * Öneriyi sisteme ilet.
   * @param {string} symbol
   * @param {'buy'|'sell'} direction
   * @param {string} reason
   * @param {number} score (1-10)
   */
  propose(symbol, direction, reason, score) {
    try {
      const stratStats = this._ensureStats();
      stratStats.overall.proposals = (stratStats.overall.proposals || 0) + 1;
      stratStats.overall.lastUpdate = Date.now();
      this.bot.saveStrategyStats?.();

      if (!this._isLive) {
        this.bot.recordShadowProposal?.(this.name, direction, reason, score);
        return;
      }

      // Kill switch
      if (this.bot.settings?.features?.enableRiskGuardian !== false &&
          this.bot.riskGuardian?.killSwitchActivated) return;

      // Per-strateji, per-yön cooldown
      const now = Date.now();
      const key = `${symbol}-${direction}`;
      const cd = this.DEFAULT_PROPOSAL_COOLDOWN_MS ?? 10000;
      if (now - (this.lastProposalTime[key] || 0) < cd) return;

      this.bot.confluenceEngine?.propose(this.name, direction, reason, score, this.ambassador);
      this.lastProposalTime[key] = now;
    } catch (error) {
      Logger.error(`Strategy:${this.name}`, 'propose hatası:', error);
    }
  }

  _getDisplayName(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  // Hook'lar — varsayılan no-op
  analyzeOrderBook() {}
  processTrade() {}
  periodicAnalyze() {}
}

export default Strategy;
