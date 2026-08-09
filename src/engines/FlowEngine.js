/**
 * FlowEngine — Order Flow Candle motoru
 * Kaynak: BOZOK PRO §6
 *
 * Trade'leri time/volume bucket'larına toplar, her bucket için
 * pressure bazlı flow candle üretir:
 *   Δ = buy - sell; Pressure = clamp(Δ/activity × 100, -100, +100)
 *   Strength = clamp(|Δ|/activity × 100, 0, 100)
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { now, clamp, pushCap } from '../core/Utils.js';

export class FlowEngine {
  constructor(bus) {
    this.bus = bus;
    this.bucket = null;
  }

  /** Trade event'inde çağrılır */
  updateBucket(trade) {
    const nowTs = now();
    if (!this.bucket) this.startBucket(trade, nowTs);

    // Time modunda süre dolduysa kapat
    if (CONFIG.flowMode === 'time' && nowTs - this.bucket.startTs >= CONFIG.flowTimeframeMs) {
      this.closeBucket();
    }
    // Volume modunda hedef aşıldıysa kapat
    if (CONFIG.flowMode === 'volume' && this.bucket.activity >= CONFIG.flowVolumeTarget) {
      this.closeBucket();
    }

    // Bucket kapandıysa yeni başlat (trade kaybolmasın)
    if (!this.bucket) this.startBucket(trade, nowTs);

    const b = this.bucket;
    if (trade.side === 'buy') b.buy += trade.notional;
    else b.sell += trade.notional;
    b.activity += trade.notional;
    b.liquidations += trade.liquidations || 0;
    b.high = Math.max(b.high, trade.price);
    b.low = Math.min(b.low, trade.price);
    b.closePrice = trade.price;
  }

  /** 250ms tick — zaman dolan bucket'ları kapat */
  tick() {
    if (!this.bucket) return;
    const nowTs = now();
    if (CONFIG.flowMode === 'time' && nowTs - this.bucket.startTs >= CONFIG.flowTimeframeMs) {
      this.closeBucket();
    }
    if (CONFIG.flowMode === 'volume' && this.bucket.activity >= CONFIG.flowVolumeTarget) {
      this.closeBucket();
    }
  }

  startBucket(trade, nowTs) {
    this.bucket = {
      startTs: nowTs,
      openPrice: trade.price,
      high: trade.price,
      low: trade.price,
      closePrice: trade.price,
      buy: 0,
      sell: 0,
      activity: 0,
      liquidations: 0,
      absorption: false
    };
  }

  closeBucket() {
    if (!this.bucket || this.bucket.activity <= 0) { this.bucket = null; return; }
    const b = this.bucket;

    const delta = b.buy - b.sell;
    const pressure = clamp((delta / b.activity) * 100, -100, 100);
    const strength = clamp((Math.abs(delta) / (b.activity || 1)) * 100, 0, 100);

    const prev = STATE.flowCandles.at(-1);
    const candle = {
      ts: b.startTs,
      pressureOpen: prev ? prev.pressureClose : 0,
      pressureHigh: pressure,
      pressureLow: pressure,
      pressureClose: pressure,
      buy: b.buy,
      sell: b.sell,
      delta,
      activity: b.activity,
      strength,
      priceOpen: b.openPrice,
      priceHigh: b.high,
      priceLow: b.low,
      priceClose: b.closePrice,
      liquidations: b.liquidations,
      absorption: b.absorption
    };

    pushCap(STATE.flowCandles, candle, 80);
    this.bucket = null;
    this.bus.emit('flow:update', candle);
    return candle;
  }

  reset() {
    this.bucket = null;
  }
}

export default FlowEngine;
