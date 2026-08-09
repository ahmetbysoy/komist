/**
 * FundingRateReversalStrategy — Fonlama oranı dönüşü
 * Kaynak: UTC v2.0 §5.1
 * |fundingRate| > %0.1 ve yön uyumsuzluğu → ters işlem.
 * (REST /fapi/v1/premiumIndex)
 */
import { Strategy } from './Strategy.js';
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class FundingRateReversalStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'fundingRateReversal', 'metatron', 'wisdom');
    this.fundingRate = 0;
    this.lastFetch = 0;
  }

  async _fetchFunding() {
    // 60s cache
    if (Date.now() - this.lastFetch < 60000) return this.fundingRate;
    try {
      const res = await fetch(
        `${CONFIG.exchange.binanceRest}/fapi/v1/premiumIndex?symbol=${this.bot.marketData.symbol}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const j = await res.json();
      this.fundingRate = parseFloat(j.lastFundingRate) || 0;
      this.lastFetch = Date.now();
    } catch (e) {
      Logger.debug('FundingRate', 'çekilemedi:', e.message);
    }
    return this.fundingRate;
  }

  async periodicAnalyze() {
    const price = this.bot.marketData.price;
    if (!price) return;
    const rate = await this._fetchFunding();
    if (Math.abs(rate) <= 0.001) return;

    // Son 3 mum yönü
    const candles = this.bot.candles;
    if (!candles || candles.length < 3) return;
    const falling = candles.at(-1).close < candles.at(-3).close;

    if (falling && rate > 0) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Fonlama %${(rate * 100).toFixed(3)} pozitif + fiyat düşüşü (short sıkışıklığı)`, 4);
    } else if (!falling && rate < 0) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Fonlama %${(rate * 100).toFixed(3)} negatif + fiyat yükselişi (long sıkışıklığı)`, 4);
    }
  }
}

export default FundingRateReversalStrategy;
