/**
 * TradeEngine — Trade sınıflandırma, CVD, VPIN, likidasyonlar
 * Kaynak: BOZOK PRO §5
 *
 * - Side sınıflandırma (m/isBuyerMaker veya mid karşılaştırma)
 * - CVD: Σ sign(side) × notional
 * - VPIN: volume-synchronized, bucket = max(100k, rollingVol × 0.001)
 *   VPIN_sample = |buy - sell| / (buy + sell); VPIN = mean(buckets)
 * - Likidasyon kaydı (forceOrder)
 */
import { STATE } from '../core/State.js';
import { now, mean, pushCap, clamp } from '../core/Utils.js';

export class TradeEngine {
  constructor(bus) {
    this.bus = bus;
  }

  /**
   * Side tayini: doğrudan side varsa onu kullan,
   * yoksa fiyat ≥ mid → buy, fiyat < mid → sell.
   */
  classifySide(trade) {
    if (trade.side === 'buy' || trade.side === 'sell') return trade.side;
    const p = trade.price;
    const b = STATE.book.bids[0]?.price ?? p;
    const a = STATE.book.asks[0]?.price ?? p;
    return p >= (a + b) / 2 ? 'buy' : 'sell';
  }

  addTrade(trade) {
    const side = this.classifySide(trade);
    const t = {
      price: +trade.price,
      qty: +trade.qty,
      notional: (+trade.price) * (+trade.qty),
      side,
      ts: trade.ts || now(),
      raw: trade
    };

    pushCap(STATE.trades, t, 1000);
    STATE.lastTradeUpdate = t.ts;

    // CVD: buy → +notional, sell → -notional
    STATE.cvd += side === 'buy' ? t.notional : -t.notional;
    pushCap(STATE.cvdHistory, { ts: t.ts, value: STATE.cvd }, 300);

    this.updateVPIN(t);

    this.bus.emit('trade:update', t);
    return t;
  }

  /** 10 saniyelik CVD değişimi (velocity) */
  cvdVelocity() {
    const cutoff = now() - 10000;
    const slice = STATE.cvdHistory.filter((c) => c.ts >= cutoff);
    const nowVal = STATE.cvdHistory.at(-1)?.value ?? 0;
    const thenVal = slice[0]?.value ?? nowVal;
    return nowVal - thenVal;
  }

  // ── VPIN ──────────────────────────────────────────────
  updateVPIN(trade) {
    const rollingVol = STATE.trades.slice(-200).reduce((a, b) => a + b.notional, 0);
    const targetBucket = Math.max(100000, rollingVol * 0.001);
    STATE.vpin.bucketSize = targetBucket;

    // Bucket doluysa kapat, sample ekle
    if (STATE.vpin.currentNotional >= targetBucket) {
      const total = STATE.vpin.currentBuy + STATE.vpin.currentSell;
      if (total > 0) {
        STATE.vpin.buckets.push(
          Math.abs(STATE.vpin.currentBuy - STATE.vpin.currentSell) / total
        );
      }
      if (STATE.vpin.buckets.length > 50) STATE.vpin.buckets.shift();
      STATE.vpin.currentBuy = 0;
      STATE.vpin.currentSell = 0;
      STATE.vpin.currentNotional = 0;
    }

    if (trade.side === 'buy') STATE.vpin.currentBuy += trade.notional;
    else STATE.vpin.currentSell += trade.notional;
    STATE.vpin.currentNotional += trade.notional;

    if (STATE.vpin.buckets.length) {
      STATE.vpin.value = mean(STATE.vpin.buckets);
      STATE.vpin.label = STATE.vpin.value < 0.3 ? 'Düşük'
        : STATE.vpin.value < 0.7 ? 'Orta' : 'Toksik';
    }

    this.bus.emit('vpin:update', STATE.vpin);
  }

  // ── Likidasyonlar ─────────────────────────────────────
  addLiquidation(liq) {
    const l = {
      side: liq.side,            // 'BUY' (short liq) | 'SELL' (long liq)
      price: +liq.price,
      qty: +liq.qty,
      notional: (+liq.price) * (+liq.qty),
      ts: liq.ts || now(),
      symbol: liq.symbol || STATE.symbol
    };
    pushCap(STATE.liquidations, l, 1000);
    this.bus.emit('liquidation:update', l);
    return l;
  }
}

export default TradeEngine;
