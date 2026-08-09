/**
 * MicroSpreadArbitrageStrategy — Mikro spread arbitrajı
 * Kaynak: UTC v2.0 (bara2 strateji)
 * Anormal geniş spread → market maker tarafına akış, spread daralması beklentisi.
 */
import { Strategy } from './Strategy.js';

export class MicroSpreadArbitrageStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'microSpreadArbitrage', 'raphael', 'healing');
    this.SPREAD_PCT = 0.08 / 100;
  }

  analyzeOrderBook(orderBook) {
    if (!orderBook || !orderBook.bids?.[0] || !orderBook.asks?.[0]) return;
    const bid = orderBook.bids[0].price;
    const ask = orderBook.asks[0].price;
    const mid = (bid + ask) / 2;
    if (!mid) return;

    const spreadPct = (ask - bid) / mid;
    // Ask kalın → spread genişliği bid tarafından beslenir → bid yönü
    if (spreadPct > this.SPREAD_PCT) {
      const bidDepth = orderBook.bids.slice(0, 5).reduce((a, b) => a + b.qty, 0);
      const askDepth = orderBook.asks.slice(0, 5).reduce((a, b) => a + b.qty, 0);
      if (bidDepth > askDepth) {
        this.propose(this.bot.marketData.symbol, 'buy',
          `Spread %${(spreadPct * 100).toFixed(3)} — bid derinliği ağır`, 3);
      } else {
        this.propose(this.bot.marketData.symbol, 'sell',
          `Spread %${(spreadPct * 100).toFixed(3)} — ask derinliği ağır`, 3);
      }
    }
  }
}

export default MicroSpreadArbitrageStrategy;
