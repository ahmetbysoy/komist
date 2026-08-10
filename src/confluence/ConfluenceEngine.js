/**
 * ConfluenceEngine — Uyum (uzlaşma) motoru
 * Kaynak: barva35.html + UTC v2.0 §6
 *
 * Akış (barva35 checkConfluence):
 *  - Zaman çürümesi e^(-ageSec/decaySec)
 *  - MTF onayı: trend 'down' → buyScore×0.6 (ayar açıksa)
 *  - Gating cezası: marketGatingPenalty (spread/depth/slippage)
 *  - minContributors / minGroups
 *  - Eşik + yön marjı + cooldown + histerezis
 *  - generateFinalSignal → pending (mum onayı) veya aktif sinyal
 */
import { Logger } from '../core/Logger.js';
import { STRATEGY_GROUPS } from '../strategies/index.js';

export class ConfluenceEngine {
  constructor(bot) {
    this.bot = bot;
    this.proposals = [];
    this.lastSignalTime = 0;
    this.lastSignalTimeByDirection = {};
    this.lastDirection = null;
    this.buyScore = 0;
    this.sellScore = 0;
  }

  propose(strategy, direction, reason, score) {
    this.proposals.push({ strategy, direction, reason, score, timestamp: Date.now() });
    if (this.proposals.length > 200) this.proposals.shift();
    this._checkConfluence();
  }

  getStrategyWeight(strategy) {
    return this.bot.getStrategyWeight?.(strategy) ?? 1.0;
  }

  _computeDirectional(direction) {
    let totalScore = 0;
    const contributors = [];
    const nowMs = Date.now();
    const decaySec = this.bot.settings?.optimization?.timeDecaySec ?? 3;

    for (const p of this.proposals) {
      if (p.direction !== direction) continue;
      const ageSec = (nowMs - p.timestamp) / 1000;
      const decay = Math.exp(-ageSec / decaySec);
      const w = this.getStrategyWeight(p.strategy);
      const eff = p.score * w * decay;
      totalScore += eff;
      contributors.push({ strategy: p.strategy, baseScore: p.score, weight: w, effScore: eff });
    }

    const groups = new Set(contributors.map((c) => this._groupOf(c.strategy)));
    return { score: totalScore, contributors, contributorsCount: contributors.length, groupsCount: groups.size };
  }

  _checkConfluence() {
    const settings = this.bot.settings || {};
    const cd = settings.cooldowns || {};
    const now = Date.now();
    const minThreshold = this.bot.getEffectiveThreshold();
    const signalCooldown = cd.signalMs ?? 15000;
    const proposalTimeout = cd.proposalTimeoutMs ?? 3000;
    const sameDirCooldown = cd.sameDirectionMs ?? 30000;
    const oppCooldown = cd.oppositeDirectionMs ?? 20000;
    const reverseHys = cd.reverseHysteresisPoints ?? 2;
    const dirMargin = settings.optimization?.dirMargin ?? 0.5;

    // Faz A #12: Panteon cooldownScale -> sinyal cooldown'larına uygula
    const panteonScale = this.bot.panteon?.getCooldownScale?.() ?? 1;
    const signalCooldownAdj = Math.round(signalCooldown * panteonScale);
    const sameDirCooldownAdj = Math.round(sameDirCooldown * panteonScale);
    const oppCooldownAdj = Math.round(oppCooldown * panteonScale);

    if (now - this.lastSignalTime < signalCooldownAdj) return;
    this.proposals = this.proposals.filter((p) => now - p.timestamp < proposalTimeout);
    if (this.proposals.length === 0) return;

    const buy = this._computeDirectional('buy');
    const sell = this._computeDirectional('sell');

    let buyScoreAdj = buy.score;
    let sellScoreAdj = sell.score;

    // MTF onayı (bilgelik faktörü)
    if (settings.features?.enableMtfConfirm) {
      const mtfTrend = this.bot.multiTimeframeManager?.getTrend?.(settings.features.mtfTimeframe || '15m');
      if (mtfTrend === 'down') buyScoreAdj *= 0.6;
      if (mtfTrend === 'up') sellScoreAdj *= 0.6;
    }

    // Gating cezası — Faz B #1: artık yön bağımlı spoof cezası da içeriyor
    const gatingEnabled = settings.optimization?.gating?.enabled;
    if (gatingEnabled) {
      buyScoreAdj -= this.bot.marketGatingPenalty?.('buy') || 0;
      sellScoreAdj -= this.bot.marketGatingPenalty?.('sell') || 0;
    }

    const q = settings.optimization?.signalQuality || { minContributors: 1, minGroups: 1 };
    const buyOk = buy.contributorsCount >= q.minContributors && buy.groupsCount >= q.minGroups;
    const sellOk = sell.contributorsCount >= q.minContributors && sell.groupsCount >= q.minGroups;

    buyScoreAdj = buyOk ? buyScoreAdj : -Infinity;
    sellScoreAdj = sellOk ? sellScoreAdj : -Infinity;

    this.buyScore = buyScoreAdj;
    this.sellScore = sellScoreAdj;

    if (buyScoreAdj >= minThreshold && buyScoreAdj > sellScoreAdj + dirMargin) {
      if (now - (this.lastSignalTimeByDirection.buy || 0) < sameDirCooldownAdj) return;
      if (this.lastDirection === 'sell' && (now - this.lastSignalTime) < oppCooldownAdj) {
        if (buyScoreAdj < minThreshold + reverseHys) return;
      }
      this.generateFinalSignal('buy', buy.contributors, buyScoreAdj);
    } else if (sellScoreAdj >= minThreshold && sellScoreAdj > buyScoreAdj + dirMargin) {
      if (now - (this.lastSignalTimeByDirection.sell || 0) < sameDirCooldownAdj) return;
      if (this.lastDirection === 'buy' && (now - this.lastSignalTime) < oppCooldownAdj) {
        if (sellScoreAdj < minThreshold + reverseHys) return;
      }
      this.generateFinalSignal('sell', sell.contributors, sellScoreAdj);
    }
  }

  /** Final sinyal üret (barva35 generateFinalSignal) */
  generateFinalSignal(direction, contributors, finalScore) {
    const contributingStrats = contributors.map((c) => this.bot.strategies[c.strategy]?.displayName || c.strategy).join(', ');
    const status = this.bot.settings?.features?.enableCandleConfirm ? 'pending' : 'active';

    const signal = {
      id: `sig_${Date.now()}`,
      timestamp: Date.now(),
      symbol: this.bot.currentSymbol,
      direction,
      price: this.bot.marketData.price,
      score: finalScore,
      reason: contributingStrats,
      contributors,
      status,
      note: '',
      mfeR: 0, beDone: false, trailingStage: 0, entrySlDistance: 0, entryTpDistance: 0,
      recommendedSize: this.bot.getRecommendedPositionSize?.(finalScore) || null
    };

    this.bot.calculateDynamicTpSl?.(signal);

    if (status === 'pending') this.bot.addPendingSignal?.(signal);
    else this.bot.activateSignal?.(signal);

    this.proposals = [];
    const now = Date.now();
    this.lastSignalTime = now;
    this.lastSignalTimeByDirection[direction] = now;
    this.lastDirection = direction;
  }

  _groupOf(strategy) {
    if (STRATEGY_GROUPS.trending.includes(strategy)) return 'trending';
    if (STRATEGY_GROUPS.meanReversion.includes(strategy)) return 'meanReversion';
    return 'neutral';
  }

  /**
   * Faz A #4: Slippage ölçümü — 2sn sonra çağrılır, yüksek slippage ise 30sn boyunca gating cezası
   * @param {number} entryPrice sinyal giriş fiyatı
   */
  measureSlippage(entryPrice) {
    const current = this.bot.marketData?.price;
    if (!entryPrice || !current) return;
    const slip = Math.abs(current - entryPrice) / entryPrice;
    // %0.1 üstü slippage = yüksek kabul et
    if (slip > 0.001) {
      this.bot.slippageHighUntil = Date.now() + 30000;
      // Logger varsa kullan
      try { Logger.warn('Confluence', `Yüksek slippage: ${(slip*100).toFixed(3)}% (entry ${entryPrice} -> now ${current})`); } catch(_){}
    }
  }

  /**
   * Faz B #1 + #12: Cooldown ölçeği ve Panteon etkisi için yardımcı
   * Panteon KIYAMET modunda cooldown uzar, İNANÇLI'da kısalır.
   */
  _applyPanteonCooldown(baseMs) {
    const scale = this.bot.panteon?.getCooldownScale?.() ?? 1;
    return Math.round(baseMs * scale);
  }

  reset() {
    this.proposals = [];
    this.lastSignalTime = 0;
    this.lastSignalTimeByDirection = {};
    this.lastDirection = null;
  }
}

export default ConfluenceEngine;
