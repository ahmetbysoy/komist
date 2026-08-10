/**
 * PaperTrading — Hafif Kağıt Trade Simülatörü (grafik.html referansı, hafif)
 * Gerçek para yok, sadece sanal pozisyonlar. Canlı sinyallerle entegre.
 * Backtest değil, canlı paper trading.
 */
import { Logger } from '../core/Logger.js';

export class PaperTrading {
  constructor(bot) {
    this.bot = bot;
    this.positions = []; // açık pozisyonlar
    this.history = []; // kapanan pozisyonlar
    this.equity = 10000; // başlangıç sanal bakiye
    this.maxSimultaneous = 3;
    this.riskPerTrade = 0.02; // %2
  }

  /**
   * Yeni sinyal geldiğinde sanal pozisyon aç
   * @param {Object} signal { id, symbol, direction, price, tp, sl, score }
   */
  openPosition(signal) {
    if (this.positions.length >= this.maxSimultaneous) {
      Logger.info('Paper', `Max pozisyon (${this.maxSimultaneous}) dolu, yeni pozisyon açılmadı: ${signal.id}`);
      return null;
    }
    if (!signal.tp || !signal.sl) return null;

    const risk = Math.abs(signal.price - signal.sl);
    const reward = Math.abs(signal.tp - signal.price);
    const rr = risk > 0 ? reward / risk : 0;
    // Basit risk yönetimi: her işlemde equity'nin %2'sini riske et
    const riskAmount = this.equity * this.riskPerTrade;
    const qty = risk > 0 ? riskAmount / risk : 0;

    const pos = {
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      signalId: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.price,
      tp: signal.tp,
      sl: signal.sl,
      qty,
      entryTime: Date.now(),
      status: 'open',
      pnl: 0,
      rMultiple: 0
    };

    this.positions.push(pos);
    Logger.info('Paper', `Pozisyon açıldı: ${pos.direction} ${pos.symbol} @${pos.entryPrice} TP:${pos.tp} SL:${pos.sl} qty:${qty.toFixed(4)}`);
    this.bot.notify?.info(`📝 Paper: ${pos.direction.toUpperCase()} ${pos.symbol} sanal pozisyon açıldı`);
    return pos;
  }

  /**
   * Her fiyat güncellemesinde çağrılır (ticker)
   * @param {number} price
   */
  update(price) {
    if (!price || !this.positions.length) return;
    const toClose = [];
    for (const pos of this.positions) {
      if (pos.status !== 'open') continue;
      let closePrice = null;
      let result = null;
      if (pos.direction === 'buy') {
        if (price >= pos.tp) { closePrice = pos.tp; result = 'tp'; }
        else if (price <= pos.sl) { closePrice = pos.sl; result = 'sl'; }
      } else {
        if (price <= pos.tp) { closePrice = pos.tp; result = 'tp'; }
        else if (price >= pos.sl) { closePrice = pos.sl; result = 'sl'; }
      }
      if (closePrice !== null) {
        pos.closePrice = closePrice;
        pos.closeTime = Date.now();
        pos.status = result;
        const pnl = pos.direction === 'buy' ? (closePrice - pos.entryPrice) * pos.qty : (pos.entryPrice - closePrice) * pos.qty;
        pos.pnl = pnl;
        pos.rMultiple = pos.qty > 0 ? pnl / (Math.abs(pos.entryPrice - pos.sl) * pos.qty) : 0;
        this.equity += pnl;
        toClose.push(pos);
        Logger.info('Paper', `Pozisyon kapandı: ${pos.id} ${result.toUpperCase()} PnL:${pnl.toFixed(2)} Equity:${this.equity.toFixed(2)}`);
        this.bot.notify?.show(`📝 Paper ${result.toUpperCase()}: ${pos.symbol} PnL:${pnl.toFixed(2)}`, result === 'tp' ? 'success' : 'danger');
      }
    }
    // Kapananları history'e taşı
    for (const pos of toClose) {
      this.positions = this.positions.filter(p => p.id !== pos.id);
      this.history.push(pos);
      if (this.history.length > 100) this.history.shift();
    }
  }

  getStats() {
    const closed = this.history;
    const total = closed.length;
    const wins = closed.filter(p => p.status === 'tp').length;
    const losses = closed.filter(p => p.status === 'sl').length;
    const winRate = total ? (wins / total * 100).toFixed(1) : '0.0';
    const totalPnl = closed.reduce((s,p) => s + p.pnl, 0);
    const avgR = total ? (closed.reduce((s,p) => s + p.rMultiple, 0) / total).toFixed(2) : '0.00';
    const profitFactor = losses ? (closed.filter(p=>p.pnl>0).reduce((s,p)=>s+p.pnl,0) / Math.abs(closed.filter(p=>p.pnl<0).reduce((s,p)=>s+p.pnl,0)) || 1).toFixed(2) : '∞';
    return { total, wins, losses, winRate, totalPnl, avgR, profitFactor, equity: this.equity, open: this.positions.length };
  }

  exportCSV() {
    if (!this.history.length) return '';
    let csv = 'id,symbol,direction,entryPrice,tp,sl,closePrice,status,pnl,rMultiple,entryTime,closeTime\n';
    for (const p of this.history) {
      csv += `"${p.id}","${p.symbol}","${p.direction}","${p.entryPrice}","${p.tp}","${p.sl}","${p.closePrice}","${p.status}","${p.pnl.toFixed(2)}","${p.rMultiple.toFixed(2)}","${new Date(p.entryTime).toISOString()}","${new Date(p.closeTime).toISOString()}"\n`;
    }
    return csv;
  }

  clear() {
    this.positions = [];
    this.history = [];
    this.equity = 10000;
    Logger.info('Paper', 'Paper trading sıfırlandı');
  }
}

export default PaperTrading;
