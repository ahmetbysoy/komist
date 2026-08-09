/**
 * PaperTradingEngine — Simüle işlem motoru
 * Kaynak: BOZOK PRO §9
 *
 *  - Trade planından pozisyon aç (slippage dahil, 30s cooldown)
 *  - Her book güncellemesinde stop/TP kontrolü
 *  - PnL, R-multiple, equity curve, maxDD, PF, Sharpe
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { now, clamp, mean, pushCap } from '../core/Utils.js';

export class PaperTradingEngine {
  constructor(bus) {
    this.bus = bus;
    this.cooldownUntil = 0;
  }

  simulateFromPlan(plan) {
    if (!plan || plan.direction === 'NEUTRAL') return;
    const nowTs = now();
    if (nowTs < this.cooldownUntil) return;
    const micro = STATE.micro;
    if (!micro) return;

    // Slippage: pozisyon boyutu / book derinliği
    const bookDepth = (STATE.micro?.depthBid || 0) + (STATE.micro?.depthAsk || 0);
    const slipBps = clamp(
      (micro.notional / Math.max(bookDepth * STATE.lastPrice, 1)) * 10000 * 0.5,
      0, 25
    );

    const fillPrice = plan.direction === 'LONG'
      ? plan.entry * (1 + slipBps / 10000)
      : plan.entry * (1 - slipBps / 10000);

    const position = {
      id: 'pos_' + nowTs,
      dir: plan.direction,
      qty: micro.qty,
      entry: fillPrice,
      stop: plan.stop,
      tp1: plan.tp1,
      tp2: plan.tp2,
      slippageBps: slipBps,
      openedAt: nowTs,
      status: 'open',
      mfeR: 0
    };

    STATE.positions.push(position);
    this.cooldownUntil = nowTs + 30000;
    this.bus.emit('paper:open', position);
  }

  /** Book/tick güncellemelerinde çağrılır */
  update() {
    const price = STATE.lastPrice;
    const open = STATE.positions.filter((p) => p.status === 'open');

    for (const p of open) {
      // MFE tracking (breakeven/trailing için)
      const rNow = p.dir === 'LONG'
        ? (price - p.entry) / Math.abs(p.entry - p.stop || 1)
        : (p.entry - price) / Math.abs(p.entry - p.stop || 1);
      p.mfeR = Math.max(p.mfeR || 0, rNow);

      // Breakeven & trailing
      const be = CONFIG.tpSl.breakeven;
      const tr = CONFIG.tpSl.trailing;
      if (be.enabled && p.mfeR >= be.beAtR && p.stop !== p.entry) {
        p.stop = p.dir === 'LONG' ? Math.max(p.stop, p.entry) : Math.min(p.stop, p.entry);
      }
      if (tr.enabled && p.mfeR >= tr.trailAfterR && STATE.micro) {
        const trailDist = STATE.micro.spread ? Math.max(STATE.micro.spread, 0) : 0;
        const newStop = p.dir === 'LONG'
          ? price - Math.max(price * 0.0015, trailDist)
          : price + Math.max(price * 0.0015, trailDist);
        p.stop = p.dir === 'LONG' ? Math.max(p.stop, newStop) : Math.min(p.stop, newStop);
      }

      let exit = null, reason = '';
      if (p.dir === 'LONG') {
        if (price <= p.stop) { exit = p.stop; reason = 'stop'; }
        else if (price >= p.tp2) { exit = p.tp2; reason = 'tp2'; }
        else if (price >= p.tp1) { exit = p.tp1; reason = 'tp1'; }
      } else {
        if (price >= p.stop) { exit = p.stop; reason = 'stop'; }
        else if (price <= p.tp2) { exit = p.tp2; reason = 'tp2'; }
        else if (price <= p.tp1) { exit = p.tp1; reason = 'tp1'; }
      }

      if (exit !== null) this.close(p, exit, reason);
    }
  }

  close(position, exitPrice, reason) {
    position.status = 'closed';
    position.closedAt = now();
    position.exit = exitPrice;
    position.reason = reason;

    const pnl = position.dir === 'LONG'
      ? (exitPrice - position.entry) * position.qty
      : (position.entry - exitPrice) * position.qty;

    const riskDist = Math.abs(position.entry - position.stop) || 1;
    const r = pnl / riskDist;   // R-multiple

    pushCap(STATE.closedPositions, position, 500);
    if (position.openedAt === position.closedAt) return; // aynı anda aç/kapa koruması

    const perf = STATE.performance;
    perf.trades += 1;
    if (pnl > 0) perf.wins += 1;
    perf.netR += r;

    // Equity curve (R biriminde)
    const eq = perf.equity;
    eq.push((eq.at(-1) ?? 0) + r);
    if (eq.length > 300) eq.shift();

    // Max Drawdown
    const peak = Math.max(...eq);
    const dd = peak > 0 ? ((peak - eq.at(-1)) / peak) * 100 : 0;
    perf.maxDD = Math.max(perf.maxDD, dd);

    // Avg hold
    perf.avgHoldMs = mean(STATE.closedPositions.slice(0, 20).map((p) => p.closedAt - p.openedAt));

    // Profit factor (basitleştirilmiş): (wins × 1.2) / max(1, losses)
    perf.pf = perf.trades
      ? Math.max(0, (perf.wins * 1.2) / Math.max(1, perf.trades - perf.wins))
      : 0;

    // Basitleştirilmiş Sharpe
    perf.sharpe = perf.trades > 5 ? perf.netR / Math.sqrt(perf.trades) : 0;

    this.bus.emit('paper:close', { position, exitPrice, reason, pnl, r });
  }

  reset() {
    STATE.positions = [];
    STATE.closedPositions = [];
    STATE.performance = {
      trades: 0, wins: 0, netR: 0, pf: 0, sharpe: 0, maxDD: 0, equity: [0], avgHoldMs: 0
    };
    this.cooldownUntil = 0;
  }
}

export default PaperTradingEngine;
