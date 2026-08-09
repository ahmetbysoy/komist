/**
 * SignalFeed — Sinyal listesi render + filtreleme
 * Kaynak: BOZOK PRO §12 (signals sekmesi)
 */
import { STATE } from '../core/State.js';
import { fmtPrice, fmtNotional } from '../core/Utils.js';

const BIAS_ICON = { bullish: '▲', bearish: '▼', warning: '⚠' };
const BIAS_COLOR = { bullish: '#10b981', bearish: '#ef4444', warning: '#f59e0b' };

export class SignalFeed {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.filter = 'all';
  }

  setFilter(filter) {
    this.filter = filter;
    this.render();
  }

  render() {
    if (!this.container) return;
    const list = STATE.signals.filter((s) =>
      this.filter === 'all' || s.bias === this.filter
    );

    if (!list.length) {
      this.container.innerHTML = '<div class="empty">Sinyal yok — dedektörler çalışıyor...</div>';
      return;
    }

    this.container.innerHTML = list.map((s) => {
      const age = Math.max(0, Math.floor((Date.now() - s.ts) / 1000));
      const color = BIAS_COLOR[s.bias] || '#f59e0b';
      return `<div class="signal-item ${s.read ? '' : 'unread'}" style="border-left:3px solid ${color}">
        <div class="sig-head">
          <span class="sig-icon" style="color:${color}">${BIAS_ICON[s.bias] || '•'}</span>
          <span class="sig-type">${s.type}</span>
          <span class="sig-conf" style="color:${color}">%${s.confidence}</span>
          <span class="sig-age">${age}s</span>
        </div>
        <div class="sig-desc">${s.description || ''}</div>
        <div class="sig-foot">
          <span>@ ${fmtPrice(s.price)}</span>
          <span>${s.zone?.price ? fmtPrice(s.zone.price) : ''}</span>
        </div>
      </div>`;
    }).join('');
  }
}

export default SignalFeed;
