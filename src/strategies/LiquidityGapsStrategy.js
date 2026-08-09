/**
 * LiquidityGapsStrategy — Likidite boşluğu sekmesi
 * Kaynak: UTC v2.0 (bara2/fulf strateji)
 * Order book'ta anormal geniş fiyat boşluğu → fiyat oraya hızla çekilebilir.
 */
import { Strategy } from './Strategy.js';

export class LiquidityGapsStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'liquidityGaps', 'raphael', 'healing');
    this.GAP_THRESHOLD_PERCENT = 0.1 / 100;
  }

  analyzeOrderBook(orderBook) {
    if (!orderBook || !orderBook.asks || !orderBook.bids) return;
    const price = this.bot.marketData.price;
    if (!price) return;

    // Ask tarafında boşluk → yukarı fırlama potansiyeli
    const asks = orderBook.asks.slice(0, 15);
    for (let i = 1; i < asks.length; i++) {
      const gapPct = (asks[i].price - asks[i - 1].price) / price;
      if (gapPct > this.GAP_THRESHOLD_PERCENT) {
        this.propose(this.bot.marketData.symbol, 'buy',
          `Ask boşluğu: %${(gapPct * 100).toFixed(3)} @ ${asks[i].price}`, 3);
        break;
      }
    }
    // Bid tarafında boşluk → aşağı düşme potansiyeli
    const bids = orderBook.bids.slice(0, 15);
    for (let i = 1; i < bids.length; i++) {
      const gapPct = (bids[i - 1].price - bids[i].price) / price;
      if (gapPct > this.GAP_THRESHOLD_PERCENT) {
        this.propose(this.bot.marketData.symbol, 'sell',
          `Bid boşluğu: %${(gapPct * 100).toFixed(3)} @ ${bids[i].price}`, 3);
        break;
      }
    }
  }
}

export default LiquidityGapsStrategy;
