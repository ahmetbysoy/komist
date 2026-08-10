/**
 * OrderFlowMomentumStrategy — Order flow momentumu
 * Kaynak: UTC v2.0 (bara/fulf strateji grubu)
 * 5s pencerede alım-satım notional dengesi: delta oranı eşiği aşarsa yön.
 */
import { Strategy } from './Strategy.js';
import { pushCap } from '../core/Utils.js';

export class OrderFlowMomentumStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'orderFlowMomentum', 'uriel', 'courage');
    this.trades = [];
    this.WINDOW_MS = 5000;
    this.DELTA_RATIO = 0.55;   // %55+ tek taraflılık
  }

  processTrade(trade) {
    pushCap(this.trades, { ...trade, ts: trade.ts || Date.now() }, 300);
    if (this.trades.length < 10) return;

    const cutoff = Date.now() - this.WINDOW_MS;
    const recent = this.trades.filter((t) => t.ts >= cutoff);
    if (recent.length < 10) return;

    let buy = 0, sell = 0;
    for (const t of recent) {
      if (t.side === 'buy') buy += t.notional;
      else sell += t.notional;
    }
    const total = buy + sell;
    if (total <= 0) return;

    const buyRatio = buy / total;
    // Faz D: CVD ile çapraz doğrulama (varsa)
    let cvdConfirm = true;
    let cvdNote = '';
    try {
      const cvd = this.bot.cvd?.getValue?.();
      if (typeof cvd === 'number' && this.bot.cvd?.history?.length > 20) {
        const cvdDelta = this.bot.cvd.history.slice(-10).reduce((s, h) => s + (h.delta||0), 0);
        // Alım akışı + CVD pozitif → güçlü teyit
        if (buyRatio > this.DELTA_RATIO && cvdDelta < 0) cvdConfirm = false;
        if (buyRatio < 1 - this.DELTA_RATIO && cvdDelta > 0) cvdConfirm = false;
        if (cvdDelta !== 0) cvdNote = ` CVD:${(cvdDelta/1000).toFixed(0)}k`;
      }
    } catch(_){}
    if (!cvdConfirm) return; // CVD çelişiyorsa sinyal üretme

    if (buyRatio > this.DELTA_RATIO) {
      this.propose(this.bot.marketData.symbol, 'buy',
        `Alım akışı %${(buyRatio * 100).toFixed(0)} (5s)${cvdNote}`, 4);
    } else if (buyRatio < 1 - this.DELTA_RATIO) {
      this.propose(this.bot.marketData.symbol, 'sell',
        `Satım akışı %${((1 - buyRatio) * 100).toFixed(0)} (5s)${cvdNote}`, 4);
    }
  }
}

export default OrderFlowMomentumStrategy;
