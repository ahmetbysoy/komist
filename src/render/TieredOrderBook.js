/**
 * TieredOrderBook — Kademeli Emir Defteri (3s1.html referansı)
 * tickSize'ın katlarına göre gruplandırma: 1x, 10x, 100x, 1000x
 * Her kademede Fiyat, Miktar ve Yön (📈📉➡️) gösterimi
 */
import { STATE } from '../core/State.js';

export class TieredOrderBook {
  constructor(containerId = 'tiered-orderbook') {
    this.container = document.getElementById(containerId);
    this.tiers = [1, 10, 100, 1000];
    this.prevGrouped = new Map(); // fiyat -> qty trend için
  }

  /**
   * @param {Object} orderBook { bids: [price,qty][], asks: [price,qty][] }
   * @param {number} tickSize
   */
  render(orderBook, tickSize) {
    if (!this.container) return;
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      this.container.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:20px;">Veri bekleniyor...</div>';
      return;
    }

    const ts = tickSize || STATE.symbolInfo?.tickSize || 0.01;
    let html = '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">';

    for (const mult of this.tiers) {
      const step = ts * mult;
      const bidsGrouped = this._groupLevels(orderBook.bids, step, 'bids');
      const asksGrouped = this._groupLevels(orderBook.asks, step, 'asks');

      html += `
        <div style="background:var(--panel-bg); border:1px solid var(--border-color); border-radius:8px; padding:8px;">
          <div style="font-size:10px; font-weight:700; color:var(--primary); margin-bottom:6px; text-align:center;">Kademe ${mult}x (${step})</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:9px;">
            <div>
              <div style="color:var(--positive); font-weight:600; margin-bottom:4px;">BIDS</div>
              ${this._renderTierTable(bidsGrouped, 'bids')}
            </div>
            <div>
              <div style="color:var(--negative); font-weight:600; margin-bottom:4px;">ASKS</div>
              ${this._renderTierTable(asksGrouped, 'asks')}
            </div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    this.container.innerHTML = html;
  }

  _groupLevels(levels, step, side) {
    const grouped = new Map();
    for (const [price, qty] of levels) {
      const bucket = Math.floor(price / step) * step;
      const key = bucket.toFixed(this._decimals(step));
      grouped.set(key, (grouped.get(key) || 0) + qty);
    }
    // Fiyata göre sırala ve ilk 5 kademe
    const sorted = Array.from(grouped.entries())
      .sort((a, b) => side === 'bids' ? parseFloat(b[0]) - parseFloat(a[0]) : parseFloat(a[0]) - parseFloat(b[0]))
      .slice(0, 5);
    return sorted;
  }

  _renderTierTable(grouped, side) {
    if (!grouped.length) return '<div style="color:var(--text-secondary);">-</div>';
    return grouped.map(([price, qty]) => {
      const prevQty = this.prevGrouped.get(price) || qty;
      let trend = '➡️';
      if (qty > prevQty * 1.05) trend = '📈';
      else if (qty < prevQty * 0.95) trend = '📉';
      this.prevGrouped.set(price, qty);
      // Renk yoğunluğu
      const maxQty = Math.max(...grouped.map(([,q]) => q));
      const intensity = Math.min(qty / maxQty, 1);
      const bg = side === 'bids' ? `rgba(40,167,69,${(intensity*0.3+0.05).toFixed(2)})` : `rgba(239,68,68,${(intensity*0.3+0.05).toFixed(2)})`;
      return `
        <div style="display:flex; justify-content:space-between; padding:3px 4px; margin:2px 0; background:${bg}; border-radius:4px; font-size:9px;">
          <span>${parseFloat(price).toFixed(this._decimalsFromStep(grouped[0][0]))}</span>
          <span>${qty.toFixed(3)} ${trend}</span>
        </div>
      `;
    }).join('');
  }

  _decimals(step) {
    const s = step.toString();
    if (s.includes('e-')) return parseInt(s.split('e-')[1]);
    if (s.includes('.')) return s.split('.')[1].replace(/0+$/, '').length || 2;
    return 2;
  }

  _decimalsFromStep(priceStr) {
    if (priceStr.includes('.')) return priceStr.split('.')[1].length;
    return 2;
  }

  clear() {
    if (this.container) this.container.innerHTML = '';
    this.prevGrouped.clear();
  }
}

export default TieredOrderBook;
