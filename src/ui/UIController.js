/**
 * UIController — DOM event binding, sekme/layer/sembol/ayar yönetimi
 * Kaynak: BOZOK PRO §12 + UTC v2.0 §21
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { fmtPrice, fmtNotional, fmtPct } from '../core/Utils.js';
import { Logger } from '../core/Logger.js';

const $ = (id) => document.getElementById(id);

export class UIController {
  constructor(bus, { app }) {
    this.bus = bus;
    this.app = app;
    this._bind();
    this._bindEvents();
  }

  // ── Genel DOM bağlama ─────────────────────────────────
  _bind() {
    // Sekmeler
    document.querySelectorAll('.navItem').forEach((n) => {
      n.addEventListener('click', () => this.switchTab(n.dataset.tab));
    });

    // Sembol girişi
    const si = $('symbolInput');
    if (si) {
      si.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.commitSymbol();
      });
    }
    if ($('symbolBtn')) $('symbolBtn').addEventListener('click', () => this.commitSymbol());

    // Katman toggles
    document.querySelectorAll('[data-layer]').forEach((el) => {
      const layer = el.dataset.layer;
      el.checked = STATE.activeLayers.includes(layer);
      el.addEventListener('change', (e) => this.toggleLayer(layer, e.target.checked));
    });

    // Ayar değişiklikleri
    document.querySelectorAll('[data-setting]').forEach((el) => {
      const key = el.dataset.setting;
      const type = el.dataset.type || el.type;
      if (type === 'checkbox') {
        el.checked = !!CONFIG[key];
        el.addEventListener('change', (e) => {
          CONFIG[key] = e.target.checked;
          this.app.onSettingChange?.(key, CONFIG[key]);
          this.app.saveSettings?.();
        });
      } else {
        el.value = CONFIG[key] ?? '';
        el.addEventListener('change', (e) => {
          const v = el.type === 'number' ? parseFloat(e.target.value) : e.target.value;
          CONFIG[key] = isFinite(v) ? v : e.target.value;
          this.app.onSettingChange?.(key, CONFIG[key]);
          this.app.saveSettings?.();
        });
      }
    });

    // Tema
    document.querySelectorAll('[data-theme-option]').forEach((el) => {
      el.addEventListener('click', () => this.app.setTheme?.(el.dataset.themeOption));
    });

    // Sinyal filtreleri
    document.querySelectorAll('.signal-filter').forEach((el) => {
      el.addEventListener('click', () => {
        this.app.signalFeed?.setFilter(el.dataset.filter);
      });
    });
  }

  // ── EventBus abonelikleri ─────────────────────────────
  _bindEvents() {
    this.bus.on('signal:updated', () => {
      this.updateSignalBadge();
      this.app.signalFeed?.render();
    });
    this.bus.on('connection:update', () => this.updateStatus());
    this.bus.on('narrative:update', (n) => {
      const el = $('narrativeText');
      if (el) el.textContent = n;
    });
    this.bus.on('plan:update', (p) => this.renderPlan(p));
    this.bus.on('microoptimizer:update', (m) => this.renderMicro(m));
    this.bus.on('micro:update', () => this.updateMicroStats());
    this.bus.on('exchanges:update', () => this.renderExchanges());
    this.bus.on('paper:close', () => this.renderPerf());
    this.bus.on('horseman:change', (h) => {
      const el = $('regimeVal');
      if (el) {
        el.textContent = h || '—';
        el.className = 'value ' + (h === 'SALGIN' ? 'c-red' : h ? 'c-pur' : '');
      }
    });
    this.bus.on('book:update', () => this.renderLadder());
  }

  /** Derinlik tablosu (ladder) — DOM tabanlı */
  renderLadder() {
    const box = $('ladderBox');
    if (!box) return;
    const bids = STATE.book.bids.slice(0, 12);
    const asks = STATE.book.asks.slice(0, 12).reverse();
    const maxQty = Math.max(
      ...bids.map((b) => b.qty),
      ...asks.map((a) => a.qty),
      1
    );
    const rows = [
      ...asks.map((l) => ({ ...l, side: 'ask' })),
      ...bids.map((l) => ({ ...l, side: 'bid' }))
    ];
    box.innerHTML = `<table class="ladder">` + rows.map((l) => `
      <tr class="${l.side}">
        <td class="qty-cell" style="width:45%">
          <span class="qty-bar" style="width:${(l.qty / maxQty) * 100}%;background:${l.side === 'bid' ? '#10b981' : '#ef4444'}"></span>
          <span style="position:relative">${l.qty.toFixed(4)}</span>
        </td>
        <td class="price">${fmtPrice(l.price)}</td>
        <td style="text-align:right;color:var(--text-dim)">${fmtNotional(l.notional)}</td>
      </tr>`).join('') + `</table>`;
  }

  // ── Sekmeler ──────────────────────────────────────────
  switchTab(tab) {
    STATE.activeTab = tab;
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    $('tab-' + tab)?.classList.add('active');

    document.querySelectorAll('.navItem').forEach((n) => n.classList.remove('active'));
    document.querySelector(`.navItem[data-tab="${tab}"]`)?.classList.add('active');

    if (tab === 'signals') STATE.signals.forEach((s) => (s.read = true));

    // Tab'a özel canvas kayıtları
    this.app.render.registerCanvas('book-canvas', 'book');
    this.app.render.registerCanvas('flow-canvas', 'flow');
    this.app.render.registerCanvas('cvd-canvas', 'cvd');
    this.app.render.registerCanvas('equity-canvas', 'equity');
    this.app.render.registerCanvas('chart-canvas', 'chart');

    this.app.render.renderAll(true);
    this.app.saveSettings?.();
  }

  // ── Katmanlar ─────────────────────────────────────────
  toggleLayer(layer, on) {
    if (on && !STATE.activeLayers.includes(layer)) STATE.activeLayers.push(layer);
    if (!on) STATE.activeLayers = STATE.activeLayers.filter((x) => x !== layer);
    this.app.render.renderAll(true);
    this.app.saveSettings?.();
  }

  // ── Sembol ────────────────────────────────────────────
  commitSymbol() {
    const input = $('symbolInput');
    if (!input) return;
    const s = input.value.toUpperCase().trim().replace(/\s/g, '');
    if (!/^[A-Z]{2,10}USDT$/.test(s)) { input.value = STATE.symbol; return; }
    if (s === STATE.symbol) return;
    this.app.changeSymbol(s);
  }

  // ── Görünüm güncellemeleri ────────────────────────────
  updateStatus() {
    const el = $('connStatus');
    if (el) {
      el.textContent = STATE.connected ? 'CANLI' : (CONFIG.useMockFallback ? 'MOCK' : 'BAĞLANTI YOK');
      el.className = STATE.connected ? 'status online' : 'status';
    }
    const sym = $('tickerSymbol');
    if (sym) sym.textContent = STATE.symbol;
    const pe = $('priceDisplay');
    if (pe) pe.textContent = fmtPrice(STATE.lastPrice);
    const ch = $('change24h');
    if (ch) {
      ch.textContent = fmtPct(STATE.priceChange24h);
      ch.style.color = STATE.priceChange24h >= 0 ? '#10b981' : '#ef4444';
    }
  }

  updateMicroStats() {
    const m = STATE.micro;
    if (!m) return;
    const set = (id, text) => {
      const el = $(id);
      if (el) el.textContent = text;
    };
    set('spreadVal', fmtPrice(m.spread));
    set('obiVal', m.obi.toFixed(3));
    set('microVal', fmtPrice(m.microprice));
    set('midVal', fmtPrice(m.mid));
    set('vpinVal', `${(STATE.vpin.value * 100).toFixed(0)}% ${STATE.vpin.label}`);
    set('cvdVal', fmtNotional(STATE.cvd));
    set('flowDeltaVal', (() => {
      const c = STATE.flowCandles.at(-1);
      return c ? fmtNotional(c.delta) : '-';
    })());
  }

  updateSignalBadge() {
    const el = $('signalBadge');
    if (el) {
      const unread = STATE.signals.filter((s) => !s.read).length;
      el.textContent = STATE.signals.length ? String(STATE.signals.length) : '';
      el.style.display = STATE.signals.length ? 'inline-flex' : 'none';
      el.style.background = unread > 0 ? '#ef4444' : '#3b82f6';
    }
  }

  renderPlan(plan) {
    if (!plan) return;
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('planDir', plan.direction);
    set('planConf', plan.confidence ? `%${plan.confidence}` : '');
    if (plan.direction !== 'NEUTRAL') {
      set('planEntry', fmtPrice(plan.entry));
      set('planStop', fmtPrice(plan.stop));
      set('planTp1', fmtPrice(plan.tp1));
      set('planTp2', fmtPrice(plan.tp2));
      set('planRR', plan.rr.toFixed(2));
      set('planReason', plan.reason || '');
    } else {
      set('planReason', plan.reason || 'Yön yok — sinyal birikimi bekleniyor');
    }
  }

  renderMicro(m) {
    if (!m) return;
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('microQty', m.qty.toFixed(6));
    set('microLev', `${m.leverage.toFixed(1)}x`);
    set('microNotional', fmtNotional(m.notional));
    set('microLiq', fmtPrice(m.liqPrice));
    set('microRisk', `$${m.maxRiskUSD.toFixed(2)}`);
  }

  renderExchanges() {
    const names = { binance: 'Binance', bybit: 'Bybit', okx: 'OKX', mexc: 'MEXC' };
    for (const [key, ex] of Object.entries(STATE.exchanges)) {
      const row = $('ex-' + key);
      if (!row) continue;
      const mid = ex.mid ? fmtPrice(ex.mid) : '—';
      const spread = ex.bid && ex.ask
        ? (((ex.ask - ex.bid) / ex.mid) * 10000).toFixed(1) + ' bps'
        : '—';
      row.innerHTML = `<span>${names[key]}</span><span class="${ex.status === 'ok' ? 'c-green' : 'c-red'}">${mid}</span><span>${spread}</span>`;
    }
  }

  renderPerf() {
    const p = STATE.performance;
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('perfTrades', p.trades);
    set('perfWR', p.trades ? ((p.wins / p.trades) * 100).toFixed(1) + '%' : '—');
    set('perfNetR', p.netR.toFixed(2) + 'R');
    set('perfPF', p.pf.toFixed(2));
    set('perfSharpe', p.sharpe.toFixed(2));
    set('perfDD', p.maxDD.toFixed(1) + '%');
  }

  log(message, type = 'info') {
    Logger.info('UI', message);
  }
}

export default UIController;
