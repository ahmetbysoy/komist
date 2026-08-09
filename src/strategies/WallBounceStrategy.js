/**
 * WallBounceStrategy — Duvar sekmesi (order book wall yansıması)
 * Kaynak: UTC v2.0 §5.1
 * Büyük wall'a yaklaşan fiyat, wall'dan geri seker (mean reversion).
 */
import { Strategy } from './Strategy.js';

export class WallBounceStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'wallBounce', 'metatron', 'wisdom');
    this.wallBtc = 20;                       // BTC cinsinden wall eşiği
    this.DISTANCE_THRESHOLD_PERCENT = 0.05 / 100;
    this.lastWallInfo = null;
  }

  analyzeOrderBook(orderBook) {
    const currentPrice = this.bot.marketData.price;
    if (!currentPrice || !orderBook) return;

    const btcPrice = this.bot.marketData.btcPrice || 70000;
    const isBtc = this.bot.marketData.symbol === 'BTCUSDT';

    // En büyük bid ve ask wall'ı bul
    let bestBidWall = null, bestAskWall = null;
    for (const level of (orderBook.bids || []).slice(0, 15)) {
      const btcVal = isBtc ? level.qty : (level.qty * level.price / btcPrice);
      if (btcVal > this.wallBtc) bestBidWall = { price: level.price, qty: level.qty, btcVal };
    }
    for (const level of (orderBook.asks || []).slice(0, 15)) {
      const btcVal = isBtc ? level.qty : (level.qty * level.price / btcPrice);
      if (btcVal > this.wallBtc) bestAskWall = { price: level.price, qty: level.qty, btcVal };
    }

    if (!bestBidWall && !bestAskWall) return;
    this.lastWallInfo = { bid: bestBidWall, ask: bestAskWall };

    if (bestBidWall) {
      const dist = Math.abs(currentPrice - bestBidWall.price) / currentPrice;
      if (dist < this.DISTANCE_THRESHOLD_PERCENT) {
        this.propose(this.bot.marketData.symbol, 'buy',
          `Duvar: ${bestBidWall.btcVal.toFixed(1)} BTC bid @ ${bestBidWall.price}`, 3);
      }
    }
    if (bestAskWall) {
      const dist = Math.abs(currentPrice - bestAskWall.price) / currentPrice;
      if (dist < this.DISTANCE_THRESHOLD_PERCENT) {
        this.propose(this.bot.marketData.symbol, 'sell',
          `Duvar: ${bestAskWall.btcVal.toFixed(1)} BTC ask @ ${bestAskWall.price}`, 3);
      }
    }
  }
}

export default WallBounceStrategy;
