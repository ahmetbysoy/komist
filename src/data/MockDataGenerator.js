/**
 * MockDataGenerator — Gerçek veri yoksa random walk simülasyonu
 * (barva35 + GPTE ailesinden; CORS/ağ hatasında terminal boş kalmaz)
 */
import { Logger } from '../core/Logger.js';

export class MockDataGenerator {
  constructor({ onBook, onTrade, onTicker } = {}) {
    this.onBook = onBook;
    this.onTrade = onTrade;
    this.onTicker = onTicker;
    this.timer = null;
    this.price = 65000;
    this.symbol = 'BTCUSDT';
  }

  start(symbol = 'BTCUSDT') {
    this.stop();
    this.symbol = symbol;
    this.price = 65000;
    Logger.info('Mock', `${symbol} mock veri başladı`);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const drift = (Math.random() - 0.5) * 50;
    this.price = Math.max(1000, this.price + drift);
    const p = this.price;

    // Ticker
    this.onTicker?.({
      c: String(p),
      P: String(((p - 65000) / 65000) * 100),
      q: String(Math.random() * 2e8),
      s: this.symbol
    });

    // Depth (20 seviye)
    const bids = [], asks = [];
    for (let i = 0; i < 20; i++) {
      bids.push([+(p - i * 5 - Math.random() * 2).toFixed(2), +((Math.random() * 5 + 0.1).toFixed(4))]);
      asks.push([+(p + i * 5 + Math.random() * 2).toFixed(2), +((Math.random() * 5 + 0.1).toFixed(4))]);
    }
    // Ara sıra wall (stratejileri besle)
    if (Math.random() > 0.8) {
      const side = Math.random() > 0.5;
      const idx = 1 + Math.floor(Math.random() * 4);
      const q = +(15 + Math.random() * 30).toFixed(4);
      if (side) bids[idx] = [+(p - idx * 5 - Math.random() * 2).toFixed(2), q];
      else asks[idx] = [+(p + idx * 5 + Math.random() * 2).toFixed(2), q];
    }
    this.onBook?.({ b: bids, a: asks, u: Date.now(), eventTime: Date.now() });

    // Trade'ler
    for (let i = 0; i < 8; i++) {
      const side = Math.random() > 0.5;
      this.onTrade?.({
        p: String(+((side ? p + Math.random() * 2 : p - Math.random() * 2).toFixed(2))),
        q: String(+((Math.random() * 0.5 + 0.001).toFixed(4))),
        m: !side,
        T: Date.now(),
        isMock: true
      });
    }
  }
}

export default MockDataGenerator;
