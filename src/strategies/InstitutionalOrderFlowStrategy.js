/**
 * InstitutionalOrderFlowStrategy — Kurumsal order flow
 * Kaynak: UTC v2.0 (bara35 strateji)
 * Top-N seviyedeki bid/ask notional dengesizliği (imbalance > 2.0).
 */
import { Strategy } from './Strategy.js';

export class InstitutionalOrderFlowStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'institutionalOrderFlow', 'raphael', 'healing');
    this.TOP_N = 5;
    this.IMB_THRESHOLD = 2.0;
  }

  analyzeOrderBook(orderBook) {
    if (!orderBook || !orderBook.bids?.length || !orderBook.asks?.length) return;

    const bidN = orderBook.bids.slice(0, this.TOP_N)
      .reduce((a, l) => a + l.qty * l.price, 0);
    const askN = orderBook.asks.slice(0, this.TOP_N)
      .reduce((a, l) => a + l.qty * l.price, 0);
    if (!bidN || !askN) return;

    const imb = bidN / askN;
    if (imb > this.IMB_THRESHOLD) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Kurumsal alım: imbalance ${imb.toFixed(1)}x`, 4);
    } else if (imb < 1 / this.IMB_THRESHOLD) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Kurumsal satım: imbalance ${(1 / imb).toFixed(1)}x`, 4);
    }
  }
}

export default InstitutionalOrderFlowStrategy;
