/**
 * UIController — DOM bağlama ve görünüm güncelleme (barva35 initUI mantığı)
 * Ticker, sinyal barları, header, panteon/kehanet panelleri, modal'lar, çizelge görünümleri.
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { formatPrice, formatVolume, getDecimalPlaces } from '../core/Utils.js';

const $ = (id) => document.getElementById(id);

export class UIController {
  constructor(bot) {
    this.bot = bot;
    this._bindStatic();
  }

  // ── Statik event bağlama ─────────────────────────────
  _bindStatic() {
    // Sembol + timeframe
    $('symbol-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.bot.changeSymbol($('symbol-input').value);
    });
    $('timeframe-select')?.addEventListener('change', (e) => {
      this.bot.changeTimeframe(e.target.value);
    });

    // Tema
    $('theme-toggle-btn')?.addEventListener('click', () => this.bot.toggleTheme());

    // Başlat / Durdur
    $('start-btn')?.addEventListener('click', () => this.bot.start());
    $('stop-btn')?.addEventListener('click', () => this.bot.stop());

    // Header collapse (mobil kontroller)
    $('header-main-bar')?.addEventListener('click', () => this.bot.toggleHeader());

    // Görünüm: grafik / ısı haritası
    $('chart-view-btn')?.addEventListener('click', () => this.bot.setView('chart'));
    $('heatmap-view-btn')?.addEventListener('click', () => this.bot.setView('heatmap'));
    $('mobile-chart-view-btn')?.addEventListener('click', () => this.bot.setView('chart'));
    $('mobile-heatmap-view-btn')?.addEventListener('click', () => this.bot.setView('heatmap'));

    // Chart zoom
    $('chart-zoom-in')?.addEventListener('click', () => this.bot.chartManager?.zoomIn());
    $('chart-zoom-out')?.addEventListener('click', () => this.bot.chartManager?.zoomOut());
    $('chart-zoom-reset')?.addEventListener('click', () => this.bot.chartManager?.resetZoom());

    // Fullscreen
    $('fullscreen-chart-btn')?.addEventListener('click', () => this.bot.enterFullscreenChart());
    $('mobile-fullscreen-chart-btn')?.addEventListener('click', () => this.bot.enterFullscreenChart());
    $('exit-fullscreen-btn')?.addEventListener('click', () => this.bot.exitFullscreenChart());

    // Panteon / modal
    $('panteon-toggle-btn')?.addEventListener('click', () => this.bot.togglePanteon());
    $('mobile-panteon-toggle-btn')?.addEventListener('click', () => this.bot.togglePanteon());
    $('open-settings-modal-btn')?.addEventListener('click', () => this.bot.openSettingsModal());
    $('mobile-open-settings-modal-btn')?.addEventListener('click', () => this.bot.openSettingsModal());
    $('close-settings-modal-btn')?.addEventListener('click', () => this.bot.closeSettingsModal());
    $('save-settings-btn')?.addEventListener('click', () => this.bot.saveSettingsFromModal());
    $('reset-all-settings-btn')?.addEventListener('click', () => this.bot.resetAllSettings());

    // Kehanet
    $('prophecy-defensive')?.addEventListener('click', () => this.bot.applyProphecy('DEFENSIVE'));
    $('prophecy-neutral')?.addEventListener('click', () => this.bot.applyProphecy('NEUTRAL'));
    $('prophecy-aggressive')?.addEventListener('click', () => this.bot.applyProphecy('AGGRESSIVE'));

    // Mobile log
    $('mobile-open-log-modal-btn')?.addEventListener('click', () => this.bot.exportLogs?.());

    // Grafiktir sinyallerini sil
    $('clear-markers-btn')?.addEventListener('click', () => this.bot.chartManager?.clearMarkers());
  }

  // ── Görünüm güncellemeleri ───────────────────────────
  updateTicker() {
    const md = STATE.marketData;
    const sym = $('ticker-bar-symbol');
    if (sym) sym.textContent = md.symbol.replace('USDT', '/USDT');
    const price = $('ticker-bar-price');
    if (price) price.textContent = formatPrice(md.price);
    const chg = $('price-change-24h');
    if (chg) {
      const ch = md.change24h;
      chg.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
      chg.style.color = ch >= 0 ? 'var(--positive)' : 'var(--negative)';
    }
    const vol = $('volume-24h');
    if (vol) vol.textContent = formatVolume(md.volume24h);
  }

  updatePriceDisplay() {
    const md = STATE.marketData;
    const cur = $('current-price');
    if (cur) {
      cur.textContent = formatPrice(md.price);
      cur.style.color = md.price >= (this._lastShownPrice || 0) ? 'var(--positive)' : 'var(--negative)';
      this._lastShownPrice = md.price;
    }
    const atr = $('atr-value');
    if (atr && STATE.indicators.atr) atr.textContent = formatPrice(STATE.indicators.atr);
  }

  updateConnection(status, text) {
    const dot = $('connection-status');
    const txt = $('connection-text');
    if (dot) dot.className = 'status-dot ' + (status ? 'online' : '');
    if (txt) txt.textContent = text || (status ? 'BAĞLANTI VAR' : 'BAĞLANTI YOK');
  }

  /** Sinyal barları (METATRON GÜVENİ / URIEL CESARETİ) */
  updateSignalBars(buyScore, sellScore) {
    const bfill = $('buy-signal-bar-fill');
    const sfill = $('sell-signal-bar-fill');
    const btext = $('buy-signal-score-text');
    const stext = $('sell-signal-score-text');
    const w = (v) => Math.min(100, Math.max(0, v * 10)) + '%';
    if (bfill) bfill.style.width = w(buyScore);
    if (sfill) sfill.style.width = w(sellScore);
    if (btext) btext.textContent = buyScore.toFixed(1);
    if (stext) stext.textContent = sellScore.toFixed(1);
  }

  /** Panteon paneli (3 elçi) */
  updatePanteon(elciler) {
    for (const e of elciler) {
      const mode = $(`${e.key}-mode`);
      const rep = $(`${e.key}-rep`);
      if (mode) {
        mode.textContent = e.mode;
        mode.className = 'elci-mode ' + (e.mode === 'İNANÇLI' ? 'inancli' : e.mode === 'ŞÜPHECİ' ? 'supheci' : 'kiyamet');
      }
      if (rep) {
        rep.textContent = Math.round(e.reputation);
        rep.className = 'elci-reputation ' + (e.reputation >= 80 ? 'inancli' : e.reputation >= 50 ? 'supheci' : 'kiyamet');
      }
    }
  }

  /** Kehanet paneli */
  updateKehanet({ session, regime, pulse, guardian }) {
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('kp-session', session);
    set('kp-regime', regime);
    set('kp-pulse', pulse);
    set('kp-guardian', guardian);
  }

  updateCandleCountdown(secs) {
    const el = $('candle-countdown');
    if (el) el.textContent = secs > 0 ? `⏳ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '--:--';
  }

  setView(view) {
    STATE.activeView = view;
    const chartView = $('chart-container-view');
    const heatView = $('heatmap-container-view');
    if (chartView) chartView.style.display = view === 'chart' ? '' : 'none';
    if (heatView) heatView.style.display = view === 'heatmap' ? '' : 'none';
    if (view === 'chart') setTimeout(() => this.bot.chartManager?.resize(), 50);
    if (view === 'heatmap') this.bot.heatmapManager?.resize();
  }

  toggleHeader() {
    document.body.classList.toggle('header-collapsed');
    STATE.headerCollapsed = document.body.classList.contains('header-collapsed');
    this.bot.saveData('utc_header_collapsed', String(STATE.headerCollapsed));
    setTimeout(() => this.bot.chartManager?.resize(), 350);
  }

  togglePanteon() {
    const panel = $('panteon-panel');
    if (panel) panel.classList.toggle('visible');
  }

  enterFullscreenChart() {
    document.body.classList.add('fullscreen-chart');
    setTimeout(() => this.bot.chartManager?.resize(), 100);
  }

  exitFullscreenChart() {
    document.body.classList.remove('fullscreen-chart');
    setTimeout(() => this.bot.chartManager?.resize(), 100);
  }

  /** Sinyal listesi render (modal içindeki tablo) */
  renderSignals(signals) {
    const tbody = $('signal-history-body');
    if (!tbody) return;
    tbody.innerHTML = signals.slice(0, 50).map((s) => `
      <tr>
        <td>${new Date(s.timestamp).toLocaleTimeString('tr-TR')}</td>
        <td>${s.symbol || STATE.symbol}</td>
        <td>${s.type || '-'}</td>
        <td>${formatPrice(s.price)}</td>
        <td>${s.tp ? formatPrice(s.tp) : '-'}</td>
        <td>${s.sl ? formatPrice(s.sl) : '-'}</td>
        <td>${s.score?.toFixed(1) ?? '-'}</td>
        <td style="color:${s.status === 'tp' ? 'var(--positive)' : s.status === 'sl' ? 'var(--negative)' : 'var(--neutral)'}">${s.status || ''}</td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">Henüz sinyal yok</td></tr>';
  }
}

export default UIController;
