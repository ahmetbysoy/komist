/**
 * MockDataGenerator — Gerçek veri yoksa random walk simülasyonu
 * Kaynak: BOZOK PRO §11 (Mock Data Generator)
 * Order book (50 seviye), trade'ler (15/sn), likidasyonlar (%10 ihtimal).
 */
import { STATE } from '../core/State.js';
import { pushCap } from '../core/Utils.js';
import { Logger } from '../core/Logger.js';

export class MockDataGenerator {
  constructor(bus, { onBook, onTrade, onLiquidation } = {}) {
    this.bus = bus;
    this.onBook = onBook;
    this.onTrade = onTrade;
    this.onLiquidation = onLiquidation;
    this.timer = null;
    this.price = 65000;
    this.seq = 1000;
  }

  start(symbol = 'BTCUSDT') {
    this.stop();
    this.price = 65000;
    Logger.info('Mock', `${symbol} mock veri başladı`);
    this.timer = setInterval(() => this.tick(symbol), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(symbol) {
    // Random walk
    const drift = (Math.random() - 0.5) * 50;
    this.price = Math.max(1000, this.price + drift);
    const p = this.price;

    // Order book — 50 seviye
    const bids = [], asks = [];
    for (let i = 0; i < 50; i++) {
      bids.push([+(p - i * 5 - Math.random()).toFixed(2), +((Math.random() * 5 + 0.1).toFixed(4))]);
      asks.push([+(p + i * 5 + Math.random()).toFixed(2), +((Math.random() * 5 + 0.1).toFixed(4))]);
    }
    // Ara sıra wall oluştur (dedektörleri beslesin)
    if (Math.random() > 0.75) {
      const side = Math.random() > 0.5;
      const idx = 1 + Math.floor(Math.random() * 4);
      const wallQty = +(20 + Math.random() * 40).toFixed(4);
      if (side) bids[idx] = [+(p - idx * 5 - Math.random()).toFixed(2), wallQty];
      else asks[idx] = [+(p + idx * 5 + Math.random()).toFixed(2), wallQty];
    }

    const snapshot = { bids, asks, lastUpdateId: ++this.seq, ts: Date.now() };
    this.onBook?.(snapshot);

    // Trade'ler — 15/sn
    for (let i = 0; i < 15; i++) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const trade = {
        price: +((side === 'buy' ? p + Math.random() * 2 : p - Math.random() * 2).toFixed(2)),
        qty: +((Math.random() * 0.5 + 0.001).toFixed(4)),
        side,
        ts: Date.now(),
        symbol,
        isMock: true
      };
      this.onTrade?.(trade);
    }

    // %10 ihtimalle likidasyon
    if (Math.random() > 0.9) {
      const side = Math.random() > 0.5 ? 'SELL' : 'BUY';
      this.onLiquidation?.({
        side,
        price: +p.toFixed(2),
        qty: +(Math.random() * 3 + 0.5).toFixed(4),
        ts: Date.now(),
        symbol,
        isMock: true
      });
    }
  }
}

export default MockDataGenerator;
