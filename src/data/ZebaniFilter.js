/**
 * ZebaniFilter — Bad Tick Filtresi (kaynak: GPTE.HTML §8.5)
 * 500ms içinde %1.5+ fiyat sıçraması → bad tick olarak filtrele.
 * Bu, bozuk/bayatsı veri kaynaklarından gelen sıçramaları temizler.
 */
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class ZebaniFilter {
  constructor() {
    this.lastPrice = null;
    this.lastTs = 0;
    this.badTickCount = 0;
    this.onBadTick = null;   // (info) => void — görsel efekt için
  }

  /**
   * @param {number} price
   * @returns {boolean} true → kabul et (temiz), false → filtrele (bad tick)
   */
  check(price) {
    if (!CONFIG.zebani.enabled) { this._update(price); return true; }

    const nowTs = Date.now();
    const dt = nowTs - this.lastTs;

    if (this.lastPrice !== null && dt <= CONFIG.zebani.windowMs) {
      const jump = Math.abs(price - this.lastPrice) / this.lastPrice;
      if (jump >= CONFIG.zebani.jumpPct) {
        this.badTickCount += 1;
        Logger.warn('Zebani', `Bad tick filtrelendi: ${this.lastPrice} → ${price} (${(jump * 100).toFixed(2)}%)`);
        this.onBadTick?.({ from: this.lastPrice, to: price, jump });
        return false;
      }
    }

    this._update(price);
    return true;
  }

  _update(price) {
    this.lastPrice = price;
    this.lastTs = Date.now();
  }

  reset() {
    this.lastPrice = null;
    this.lastTs = 0;
    this.badTickCount = 0;
  }
}

export default ZebaniFilter;
