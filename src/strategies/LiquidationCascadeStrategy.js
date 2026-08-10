/**
 * LiquidationCascadeStrategy — Likidasyon kaskadı
 * Kaynak: UTC v2.0 §5.2
 * 1 saniyelik hacim > 15× ortalama saniye hacmi → kaskad;
 * son trade yönünün tersine işlem (stop avı bittiğinde dönüş).
 */
import { Strategy } from './Strategy.js';

export class LiquidationCascadeStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'liquidationCascade', 'uriel', 'courage');
    this.SPIKE_MULT = 15;
    this.secVolumes = [];
    this.currentSec = 0;
    this.currentVol = 0;
    this.recentForceOrders = []; // gerçek forceOrder verisi için
  }

  /**
   * Tahmini kaskad (hacim sıçraması) — mevcut mantık korundu
   */
  processTrade(trade) {
    const ts = Date.now();
    const sec = Math.floor(ts / 1000);
    if (sec !== this.currentSec) {
      this.secVolumes.push(this.currentVol);
      if (this.secVolumes.length > 30) this.secVolumes.shift();
      this.currentSec = sec;
      this.currentVol = 0;
    }
    this.currentVol += trade.notional;

    if (this.secVolumes.length >= 5) {
      const avg = this.secVolumes.reduce((a, b) => a + b, 0) / this.secVolumes.length;
      if (this.currentVol > avg * this.SPIKE_MULT && avg > 0) {
        // Son trade yönünün tersine (kaskad sonrası dönüş)
        this.propose(this.bot.marketData.symbol,
          trade.side === 'buy' ? 'sell' : 'buy',
          `Likidasyon kaskadı (tahmini): ${(this.currentVol / 1e6).toFixed(1)}M$/sn`, 5);
      }
    }
  }

  /**
   * Gerçek likidasyon feed'i (Binance @forceOrder) — Faz D
   * Binance'ten gelen gerçek likidasyon emri, tahminden çok daha isabetli.
   * @param {Object} forceOrder { symbol, side: 'BUY'|'SELL', price, quantity, notional, ts }
   */
  processForceOrder(forceOrder) {
    // Son 5 sn içinde gelen forceOrder'ları topla
    const now = Date.now();
    this.recentForceOrders.push({ ...forceOrder, ts: now });
    // 5 sn pencere
    this.recentForceOrders = this.recentForceOrders.filter(o => now - o.ts < 5000);
    if (this.recentForceOrders.length < 2) return; // tekil likidasyon değil, kaskad arıyoruz

    // Toplam notional
    const totalNotional = this.recentForceOrders.reduce((s, o) => s + (o.notional || o.price * o.quantity || 0), 0);
    // Son likidasyonların çoğunluğu aynı yönde mi?
    const buyCount = this.recentForceOrders.filter(o => o.side === 'BUY').length;
    const sellCount = this.recentForceOrders.length - buyCount;
    const isLongLiquidation = sellCount > buyCount; // long likidasyonu → sell forceOrder
    const isShortLiquidation = buyCount > sellCount;

    // Kaskad eşiği: 5sn içinde 2+ likidasyon ve toplam > 50k notional (sembol hacmine göre ayarlanabilir)
    if (totalNotional > 50000) {
      const direction = isLongLiquidation ? 'buy' : isShortLiquidation ? 'sell' : null;
      if (!direction) return;
      const sideText = isLongLiquidation ? 'LONG' : 'SHORT';
      // Kaskad sonrası dönüş yönü (stop avı bitti → tersine)
      // Long likidasyonu (sell) sonrası → buy (dipten dönüş)
      // Short likidasyonu (buy) sonrası → sell (tepeden dönüş)
      this.propose(this.bot.marketData.symbol, direction,
        `Gerçek likidasyon kaskadı: ${sideText} ${this.recentForceOrders.length} adet, ${(totalNotional/1000).toFixed(0)}k$ (5s)`, 7);
    }
  }
}

export default LiquidationCascadeStrategy;
