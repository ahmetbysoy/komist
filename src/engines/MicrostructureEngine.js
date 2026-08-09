/**
 * MicrostructureEngine — Order Book motoru
 * Kaynak: BOZOK PRO §4
 *
 * Sorumluluklar:
 *  - Snapshot uygula (REST depth)
 *  - Diff uygula (WS depth@100ms, out-of-order koruması)
 *  - recompute(): spread, OBI, microprice, slope (OLS), derinlik
 *  - VPVR heatmap geçmişi tut
 */
import { STATE } from '../core/State.js';
import { now, rollingSlope, mean, pushCap } from '../core/Utils.js';
import { CONFIG } from '../core/Config.js';

const MAX_LEVELS = 200;

export class MicrostructureEngine {
  constructor(bus) {
    this.bus = bus;
    this.bestBid = 0;
    this.bestAsk = 0;
  }

  // ── Snapshot ──────────────────────────────────────────
  applySnapshot(symbol, snapshot) {
    const parse = (arr = []) => arr.map(([p, q]) => ({
      price: +p, qty: +q, notional: (+p) * (+q)
    }));

    const bids = parse(snapshot.bids).sort((a, b) => b.price - a.price);
    const asks = parse(snapshot.asks).sort((a, b) => a.price - b.price);

    STATE.book = { bids, asks, ts: now(), lastUpdateId: snapshot.lastUpdateId || 0 };
    STATE.bookSeq = snapshot.lastUpdateId || 0;
    STATE.lastBookUpdate = STATE.book.ts;
    this.recompute();
    this.bus.emit('book:update', STATE.book);
  }

  // ── Diff (incremental) ────────────────────────────────
  applyDiff(diff) {
    const { bids = [], asks = [], U, u } = diff;

    // Out-of-order mesajları reddet
    if (STATE.book.lastUpdateId && U && u && u <= STATE.book.lastUpdateId) return false;

    const bookB = new Map(STATE.book.bids.map((l) => [l.price.toFixed(8), l]));
    const bookA = new Map(STATE.book.asks.map((l) => [l.price.toFixed(8), l]));

    const applySide = (arr, map) => {
      for (const [p, q] of arr) {
        const price = +p, qty = +q;
        const key = price.toFixed(8);
        if (qty <= 0) map.delete(key);
        else map.set(key, { price, qty, notional: price * qty });
      }
    };
    applySide(bids, bookB);
    applySide(asks, bookA);

    STATE.book.bids = [...bookB.values()].sort((a, b) => b.price - a.price).slice(0, MAX_LEVELS);
    STATE.book.asks = [...bookA.values()].sort((a, b) => a.price - b.price).slice(0, MAX_LEVELS);

    STATE.book.lastUpdateId = u || STATE.book.lastUpdateId;
    STATE.book.ts = now();
    STATE.lastBookUpdate = STATE.book.ts;
    STATE.marketLatencyMs = Math.max(0, now() - (diff.eventTime || STATE.book.ts));

    this.recompute();
    this.bus.emit('book:update', STATE.book);
    return true;
  }

  // ── Temel metrikler ───────────────────────────────────
  recompute() {
    const b = STATE.book.bids[0];
    const a = STATE.book.asks[0];
    if (!b || !a) return;

    STATE.prevPrice = STATE.lastPrice || ((b.price + a.price) / 2);
    STATE.lastPrice = (b.price + a.price) / 2;
    this.bestBid = b.price;
    this.bestAsk = a.price;

    const spread = a.price - b.price;
    const mid = (a.price + b.price) / 2;

    const levels = Math.min(10, STATE.book.bids.length, STATE.book.asks.length);
    const bidQty = STATE.book.bids.slice(0, levels).reduce((x, y) => x + y.qty, 0);
    const askQty = STATE.book.asks.slice(0, levels).reduce((x, y) => x + y.qty, 0);

    // Microprice: P_µ = (P_ask·Q_bid + P_bid·Q_ask) / (Q_bid + Q_ask)
    const microprice = (a.price * b.qty + b.price * a.qty) / (b.qty + a.qty || 1);

    // OBI ∈ [-1, +1]
    const obi = (bidQty - askQty) / (bidQty + askQty || 1);

    const bidSlope = rollingSlope(STATE.book.bids.slice(0, levels));
    const askSlope = rollingSlope(STATE.book.asks.slice(0, levels));

    STATE.micro = {
      bestBid: b.price,
      bestAsk: a.price,
      spread,
      mid,
      obi,
      microprice,
      bidSlope,
      askSlope,
      depthBid: bidQty,
      depthAsk: askQty
    };

    // VPVR heatmap geçmişi (son 30sn × 10 frame)
    pushCap(STATE.heatHistory, {
      ts: now(),
      bids: STATE.book.bids.slice(0, 20),
      asks: STATE.book.asks.slice(0, 20)
    }, CONFIG.heatmapWindowSec * 10);

    this.bus.emit('micro:update', STATE.micro);
  }

  /** Spread bps (normalize) */
  spreadBps() {
    const m = STATE.micro;
    if (!m || !m.mid) return 0;
    return (m.spread / m.mid) * 10000;
  }
}

export default MicrostructureEngine;
