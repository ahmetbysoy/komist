/**
 * SignalEngine — Sinyal yönetimi, trade planı, Kelly sizing
 * Kaynak: BOZOK PRO §8 + §13 (decay & expiry)
 *
 *  - Deduplikasyon (10s + %0.05 fiyat toleransı)
 *  - Confidence haircut (bayat/gecikme)
 *  - Narrative (son 60s bullish/bearish oranı)
 *  - Trade planı (entry/SL/TP1/TP2, RR ≥ minRR kontrolü)
 *  - Micro optimizer (Kelly Criterion, leverage, fee, liq price)
 *  - Decay: decay(t) = e^(-age/60000) × e^(-distance×8)
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { now, uid, clamp, pushCap } from '../core/Utils.js';

export class SignalEngine {
  constructor(bus) {
    this.bus = bus;
  }

  // ── Sinyal ekleme ─────────────────────────────────────
  addSignal(sig) {
    const ts = now();

    // Deduplikasyon: aynı tür, 10s içinde, %0.05 fiyat yakınlığı
    const dedup = STATE.signals.find((s) =>
      s.type === sig.type &&
      ts - s.ts < 10000 &&
      Math.abs((s.price || 0) - (sig.price || 0)) / (sig.price || 1) < 0.0005
    );
    if (dedup) return null;

    // Confidence ayarı
    let confidence = clamp(sig.confidence || 0, 0, 100);
    if (STATE.stale) confidence *= 0.85;
    if (STATE.marketLatencyMs > CONFIG.marketLatencyHaircutAfterMs) confidence *= 0.9;

    const signal = {
      id: uid(),
      type: sig.type,
      bias: sig.bias || 'warning',
      confidence: Math.round(confidence),
      description: sig.description || '',
      price: sig.price || STATE.lastPrice,
      ts,
      zone: sig.zone || null,
      evidence: sig.evidence || {},
      read: false,
      decay: 1,
      expiresAt: ts + 60000
    };

    STATE.signals.unshift(signal);
    if (STATE.signals.length > 100) STATE.signals.pop();
    STATE.signalId += 1;

    this.updateNarrative();
    this.generateTradePlan();
    this.bus.emit('signal:updated', signal);
    return signal;
  }

  // ── Narrative ─────────────────────────────────────────
  updateNarrative() {
    const recent = STATE.signals.filter((s) => now() - s.ts < 60000).slice(0, 10);
    const bullish = recent.filter((s) => s.bias === 'bullish');
    const bearish = recent.filter((s) => s.bias === 'bearish');

    let narrative;
    if (bullish.length > bearish.length + 2) {
      narrative = '🟢 Güçlü alım akışı: ' + bullish.slice(0, 3).map((s) => s.description).join(' | ');
    } else if (bearish.length > bullish.length + 2) {
      narrative = '🔴 Güçlü satım baskısı: ' + bearish.slice(0, 3).map((s) => s.description).join(' | ');
    } else if (bullish.length && bearish.length) {
      narrative = '⚡ Çelişkili akış: hem alım hem satım sinyalleri aktif. Bekle-gör modu.';
    } else {
      narrative = '⏸️ Piyasa sakin, belirgin bir yön yok. Veri biriktiriliyor...';
    }
    STATE.narrative = narrative;
    this.bus.emit('narrative:update', narrative);
  }

  // ── Sinyal scoring (30s, confidence × decay ağırlıklı) ─
  scoreSignals() {
    const recent = STATE.signals.filter((s) => now() - s.ts < 30000);
    let bull = 0, bear = 0, warning = 0;
    for (const s of recent) {
      const w = s.confidence * (s.decay || 1);
      if (s.bias === 'bullish') bull += w;
      else if (s.bias === 'bearish') bear += w;
      else warning += w * 0.5;
    }
    return { bull, bear, warning, recent };
  }

  // ── Trade planı ───────────────────────────────────────
  generateTradePlan() {
    const score = this.scoreSignals();
    const price = STATE.lastPrice;
    if (!price) return;

    const b = STATE.book.bids[0], a = STATE.book.asks[0];
    const spread = (a && b) ? (a.price - b.price) : price * 0.0001;

    const strongWallBid = [...STATE.detectorState.walls.bid]
      .sort((x, y) => y.notional - x.notional)[0];
    const strongWallAsk = [...STATE.detectorState.walls.ask]
      .sort((x, y) => y.notional - x.notional)[0];

    let direction = 'NEUTRAL';
    let confidence = 0;

    if (score.bull > score.bear + 50 && score.bull > CONFIG.minConfidence) {
      direction = 'LONG';
      confidence = clamp(50 + (score.bull - score.bear) / 5, 50, 95);
    } else if (score.bear > score.bull + 50 && score.bear > CONFIG.minConfidence) {
      direction = 'SHORT';
      confidence = clamp(50 + (score.bear - score.bull) / 5, 50, 95);
    }

    if (direction === 'NEUTRAL') {
      STATE.tradePlan = { direction: 'NEUTRAL', confidence: 0, ts: now() };
      this.bus.emit('plan:update', STATE.tradePlan);
      return;
    }

    const buffer = Math.max(spread * 2, price * 0.0002);
    const atr = Math.max(spread * 5, price * 0.0015);

    let entry, stop, tp1, tp2;
    if (direction === 'LONG') {
      entry = price + buffer;
      stop = strongWallBid
        ? Math.min(entry - atr * 1.4, strongWallBid.price - spread * 2)
        : entry - atr * 1.4;
      tp1 = strongWallAsk
        ? Math.min(entry + atr * 2, strongWallAsk.price - spread)
        : entry + atr * 2;
      tp2 = entry + atr * 3.5;
    } else {
      entry = price - buffer;
      stop = strongWallAsk
        ? Math.max(entry + atr * 1.4, strongWallAsk.price + spread * 2)
        : entry + atr * 1.4;
      tp1 = strongWallBid
        ? Math.max(entry - atr * 2, strongWallBid.price + spread)
        : entry - atr * 2;
      tp2 = entry - atr * 3.5;
    }

    const risk = Math.abs(entry - stop);
    const reward = Math.abs(tp1 - entry);
    const rr = risk > 0 ? reward / risk : 0;

    if (rr < CONFIG.minRR) {
      STATE.tradePlan = {
        direction: 'NEUTRAL', confidence: 0, ts: now(),
        reason: `RR too low (${rr.toFixed(2)} < ${CONFIG.minRR})`
      };
      this.bus.emit('plan:update', STATE.tradePlan);
      return;
    }

    STATE.tradePlan = {
      direction, confidence, entry, stop, tp1, tp2, rr,
      ts: now(),
      reason: score.recent.slice(0, 3).map((s) => s.description).join(' + '),
      walls: { strongWallBid, strongWallAsk }
    };
    this.bus.emit('plan:update', STATE.tradePlan);
    this.calculateMicroOptimizer();
  }

  // ── Kelly Micro Optimizer ─────────────────────────────
  calculateMicroOptimizer() {
    const plan = STATE.tradePlan;
    if (!plan || plan.direction === 'NEUTRAL') { STATE.micro = null; return; }

    const bal = CONFIG.balance;
    const maxRisk = bal * (CONFIG.riskPct / 100);
    const entry = plan.entry, stop = plan.stop;
    const riskPerUnit = Math.abs(entry - stop);
    if (!riskPerUnit) return;

    let qty = maxRisk / riskPerUnit;
    const notional = qty * entry;
    const leverage = clamp(notional / bal, 1, CONFIG.maxLeverage);
    const margin = notional / leverage;
    const fee = notional * (CONFIG.feeRateBps / 10000) * 2;
    const breakEven = fee / qty;

    // Likidasyon fiyatı
    const mmr = CONFIG.mmr;
    const liqPrice = plan.direction === 'LONG'
      ? entry * (1 - (1 / leverage) + mmr)
      : entry * (1 + (1 / leverage) - mmr);

    // Kelly: winRate - (1-winRate)/RR, [0, 0.25] arası
    const perf = STATE.performance;
    const winRate = perf.trades ? perf.wins / perf.trades : 0.5;
    const rr = plan.rr || 2.5;
    const kelly = clamp(winRate - ((1 - winRate) / Math.max(rr, 0.1)), 0, 0.25);
    const kellyScaled = clamp(CONFIG.kellyFraction * (kelly / 0.25 + 0.2), 0.1, 1);
    qty = qty * kellyScaled;

    STATE.micro = {
      riskPct: CONFIG.riskPct,
      qty,
      notional: qty * entry,
      margin,
      leverage,
      fee,
      breakEven,
      liqPrice,
      maxRiskUSD: maxRisk,
      rr: plan.rr,
      kelly
    };
    this.bus.emit('microoptimizer:update', STATE.micro);
  }

  // ── Decay & Expiry (5s'de bir) ────────────────────────
  applyDecay() {
    const t = now();
    for (const s of STATE.signals) {
      const age = t - s.ts;
      const dist = Math.max(0.0001,
        Math.abs((STATE.lastPrice || s.price) - (s.price || STATE.lastPrice))
        / (s.price || STATE.lastPrice || 1)
      );
      s.decay = Math.exp(-age / 60000) * Math.exp(-dist * 8);
      s.confidence = Math.round(clamp((s.confidence || 0) * s.decay, 0, 100));
    }
    const before = STATE.signals.length;
    STATE.signals = STATE.signals.filter((s) => t < s.expiresAt && s.confidence > 5);
    return before - STATE.signals.length;
  }
}

export default SignalEngine;
