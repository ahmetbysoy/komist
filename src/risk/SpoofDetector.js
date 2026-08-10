/**
 * SpoofDetector — Sahte emir (spoof) avcısı
 * Kaynak: barva35.html + UTC v2.0 §4.11
 * Büyük emirler Map'te izlenir; 15s içinde kaybolursa → spoof.
 * Eşik oto-optimizasyonu: reddetme oranı > %60 → +10%, < %30 → -5%.
 */
import { Logger } from '../core/Logger.js';

export class SpoofDetector {
  constructor(bot) {
    this.bot = bot;
    this.largeOrderThreshold = 10;      // BTC
    this.trackedOrders = new Map();     // fiyat → {qty, ts, type}
    this.PRICE_PROXIMITY = 0.0005;      // %0.05
    this.COOLDOWN = 30000;              // 30sn bildirim cooldown
    this.lastNotify = {};
    this.rejectRatio = 0;
    this.spoofCount = 0;
    this.totalTracked = 0;
  }

  /**
   * Her depth güncellemesinde çağrılır.
   * @param {Object} orderBook { bids: [price,qty][], asks: [price,qty][] }
   */
  trackOrderBook(orderBook) {
    if (!orderBook?.bids || !orderBook?.asks) return;
    const nowTs = Date.now();
    const price = this.bot.marketData.price;
    const isBtc = (this.bot.marketData.symbol || '').startsWith('BTC');

    const levels = [
      ...orderBook.bids.map(([p, q]) => ({ price: p, qty: q, type: 'bid' })),
      ...orderBook.asks.map(([p, q]) => ({ price: p, qty: q, type: 'ask' }))
    ];

    // Büyük emirleri izle
    for (const lv of levels) {
      const btcVal = isBtc ? lv.qty : (lv.qty * lv.price) / (this.bot.marketData.btcPrice || price || 1);
      if (btcVal >= this.largeOrderThreshold) {
        const key = `${lv.type}-${lv.price.toFixed(2)}`;
        if (!this.trackedOrders.has(key)) {
          this.trackedOrders.set(key, { qty: lv.qty, ts: nowTs, type: lv.type });
          this.totalTracked = (this.totalTracked || 0) + 1;
        } else {
          this.trackedOrders.get(key).ts = nowTs;
        }
      }
    }

    // 15s içinde kaybolan büyük emir → spoof
    const keysToRemove = [];
    for (const [key, info] of this.trackedOrders) {
      const stillThere = levels.some((l) =>
        l.type === info.type && Math.abs(l.price - parseFloat(key.split('-')[1])) / (price || 1) < this.PRICE_PROXIMITY
      );
      if (!stillThere) {
        const age = nowTs - info.ts;
        if (age < 15000) {
          keysToRemove.push(key);
          this._notifySpoof(info, nowTs);
        } else {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => this.trackedOrders.delete(k));
  }

  _notifySpoof(info, nowTs) {
    if (nowTs - (this.lastNotify[info.type] || 0) < this.COOLDOWN) return;
    this.lastNotify[info.type] = nowTs;
    // Faz B #1: Spoof bilgisini App'e aktar -> Confluence gating cezası için
    if (this.bot) {
      this.bot.lastSpoofTime = nowTs;
      this.bot.lastSpoofType = info.type;
      // Reject ratio için sayım
      this.spoofCount = (this.spoofCount || 0) + 1;
    }
    const bias = info.type === 'bid' ? 'bullish' : 'bearish'; // bid spoof çekilirse gerçekte satmak istiyorlar
    this.bot.showNotification?.(`🕵️ Spoof tespit: ${info.type.toUpperCase()} emri ${info.qty.toFixed(3)} birim çekildi!`, 'warning');
    this.bot.speak?.(`Spoof tespit edildi. ${info.type} emri çekildi.`);
    Logger.warn('Spoof', `${info.type} spoof: ${info.qty.toFixed(3)} birim çekildi`);
  }

  /** Eşik oto-optimizasyonu (UTC §4.11) — Faz A #10: artık periyodik çağrılıyor + rejectRatio gerçekten hesaplanıyor */
  autoOptimizeThreshold() {
    // Reject ratio'yu güncelle: spoof / toplam izlenen
    if (this.totalTracked > 20) {
      this.rejectRatio = Math.min(1, this.spoofCount / this.totalTracked);
      // Pencereyi kaydır: her optimizasyonda sayıları yarıla (exponential decay)
      this.spoofCount *= 0.9;
      this.totalTracked *= 0.9;
    }
    if (this.rejectRatio > 0.6) this.largeOrderThreshold = Math.min(50, this.largeOrderThreshold * 1.1);
    else if (this.rejectRatio < 0.3) this.largeOrderThreshold = Math.max(5, this.largeOrderThreshold * 0.95);
  }

  reset() {
    this.trackedOrders.clear();
    this.lastNotify = {};
  }
}

export default SpoofDetector;
