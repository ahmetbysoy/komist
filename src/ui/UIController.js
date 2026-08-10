/**
 * UIController — DOM bağlama ve görünüm güncelleme (barva35 initUI mantığı)
 * Ticker, sinyal barları, header, panteon/kehanet panelleri, modal'lar, çizelge görünümleri.
 * 
 * FIX 2026-08-10: Alt menü / çift tıklama / overlay kapanma sorunları düzeltildi
 * FEAT Faz C (2026-08-10): Strateji performans paneli + MTF özet + sinyal filtre/export
 */
import { STATE } from '../core/State.js';
import { CONFIG } from '../core/Config.js';
import { formatPrice, formatVolume, getDecimalPlaces } from '../core/Utils.js';

const $ = (id) => document.getElementById(id);

export class UIController {
  constructor(bot) {
    this.bot = bot;
    this.signalFilters = { direction: '', status: '', symbol: '' };
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
    // Faz D: Borsa seçici
    $('exchange-select')?.addEventListener('change', (e) => {
      this.bot.changeExchange(e.target.value);
    });

    // Tema
    $('theme-toggle-btn')?.addEventListener('click', () => this.bot.toggleTheme());

    // Başlat / Durdur
    $('start-btn')?.addEventListener('click', () => this.bot.start());
    $('stop-btn')?.addEventListener('click', () => this.bot.stop());

    // Header collapse (mobil kontroller) — FIX: hem header bar hem de ☰ butonu çalışsın, propagation durdurulsun
    const headerBar = $('header-main-bar');
    const mobileToggle = $('mobile-toggle-controls-btn');
    if (headerBar) {
      headerBar.addEventListener('click', (e) => {
        if (e.target.closest('button') && e.target.id !== 'header-main-bar') return;
        this.bot.toggleHeader();
      });
    }
    if (mobileToggle) {
      mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bot.toggleHeader();
      });
    }
    $('mobile-chart-view-btn')?.addEventListener('click', (e) => e.stopPropagation());
    $('mobile-heatmap-view-btn')?.addEventListener('click', (e) => e.stopPropagation());
    $('open-settings-modal-btn')?.addEventListener('click', (e) => e.stopPropagation());

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

    // FIX: Overlay dışına tıklayınca modal kapanma
    const overlay = $('settings-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.bot.closeSettingsModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const ov = $('settings-modal-overlay');
        if (ov?.classList.contains('visible')) this.bot.closeSettingsModal();
        if (document.body.classList.contains('fullscreen-chart')) this.bot.exitFullscreenChart();
      }
    });

    // FIX: Çift tıklama ile menü
    const liveChart = $('live-chart');
    if (liveChart) {
      liveChart.addEventListener('dblclick', () => this.bot.openSettingsModal());
      liveChart.style.pointerEvents = 'auto';
    }
    const signalBars = $('signal-progress-bar-container');
    if (signalBars) {
      signalBars.addEventListener('dblclick', () => this.bot.openSettingsModal());
      signalBars.title = 'Çift tıkla: Ayarlar';
    }
    headerBar?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      this.bot.openSettingsModal();
    });

    // Kehanet
    $('prophecy-defensive')?.addEventListener('click', () => this.bot.applyProphecy('DEFENSIVE'));
    $('prophecy-neutral')?.addEventListener('click', () => this.bot.applyProphecy('NEUTRAL'));
    $('prophecy-aggressive')?.addEventListener('click', () => this.bot.applyProphecy('AGGRESSIVE'));

    // Mobile log
    $('mobile-open-log-modal-btn')?.addEventListener('click', () => this.bot.exportLogs?.());

    // Grafiktir sinyallerini sil
    $('clear-markers-btn')?.addEventListener('click', () => this.bot.chartManager?.clearMarkers());

    // Akordeon Ayarlar (BÖLÜM 3) — panel-title'a tıklayınca grubu aç/kapat
    document.querySelectorAll('.settings-group .panel-title').forEach(title => {
      title.style.cursor = 'pointer';
      title.addEventListener('click', () => {
        const group = title.closest('.settings-group');
        if (group) group.classList.toggle('collapsed');
      });
    });
    // İlk yüklemede ilk 2 grup açık, diğerleri kapalı
    document.querySelectorAll('.settings-group').forEach((g, i) => {
      if (i > 1) g.classList.add('collapsed');
    });

    // Patch #7: Şeref Tablosu / Banlılar
    $('honor-board-btn')?.addEventListener('click', () => this.bot.openHonorModal());
    $('banned-board-btn')?.addEventListener('click', () => this.bot.openHonorModal('banned'));
    $('mobile-honor-board-btn')?.addEventListener('click', () => this.bot.openHonorModal());
    $('mobile-banned-board-btn')?.addEventListener('click', () => this.bot.openHonorModal('banned'));
    $('close-honor-modal')?.addEventListener('click', () => this.bot.closeHonorModal());
    $('honor-modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'honor-modal-overlay') this.bot.closeHonorModal(); });

    // ── Faz C: Sinyal filtreleri ───────────────────────
    $('filter-signal-direction')?.addEventListener('change', (e) => {
      this.signalFilters.direction = e.target.value;
      this.renderSignals(this.bot.signals || []);
    });
    $('filter-signal-status')?.addEventListener('change', (e) => {
      this.signalFilters.status = e.target.value;
      this.renderSignals(this.bot.signals || []);
    });
    $('filter-signal-symbol')?.addEventListener('input', (e) => {
      this.signalFilters.symbol = e.target.value.toUpperCase().trim();
      this.renderSignals(this.bot.signals || []);
    });
    $('clear-signal-filter-btn')?.addEventListener('click', () => {
      this.signalFilters = { direction: '', status: '', symbol: '' };
      const d = $('filter-signal-direction'); if (d) d.value = '';
      const s = $('filter-signal-status'); if (s) s.value = '';
      const sym = $('filter-signal-symbol'); if (sym) sym.value = '';
      this.renderSignals(this.bot.signals || []);
    });

    // Faz C: Export butonları
    $('export-signal-csv-btn')?.addEventListener('click', () => this.exportSignalCSV());
    $('export-signal-json-btn')?.addEventListener('click', () => this.exportSignalJSON());
    $('clear-signal-history-btn')?.addEventListener('click', () => {
      if (confirm('Tüm sinyal geçmişi silinsin mi?')) {
        this.bot.signals = [];
        this.bot.pendingSignals = [];
        this.bot.saveData('utc_signals', []);
        this.renderSignals([]);
        this.bot.notify?.warning('Sinyal geçmişi temizlendi');
      }
    });

    // Faz C: Strateji performans export
    $('export-strategy-csv-btn')?.addEventListener('click', () => this.exportStrategyCSV());
    $('refresh-strategy-perf-btn')?.addEventListener('click', () => this.renderStrategyPerformance());

    // Sinyal geçmişi satırına tıklama
    $('signal-history-body')?.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const idx = Array.from(tr.parentNode.children).indexOf(tr);
      const filtered = this._getFilteredSignals(this.bot.signals || []);
      const sig = filtered[idx];
      if (sig) console.log('Sinyal detay:', sig);
    });
    $('signal-history-body')?.addEventListener('dblclick', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const idx = Array.from(tr.parentNode.children).indexOf(tr);
      const filtered = this._getFilteredSignals(this.bot.signals || []);
      const sig = filtered[idx];
      if (sig) {
        this.bot.showNotification?.(`${sig.direction.toUpperCase()} ${sig.symbol} Skor:${sig.score?.toFixed(1)} TP:${formatPrice(sig.tp)} SL:${formatPrice(sig.sl)}`, 'info', 8000);
      }
    });
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
    const detail = $('connection-detail');
    const lastmsg = $('conn-lastmsg');
    const packets = $('conn-packets');
    if (dot) dot.className = 'status-dot ' + (status ? 'online' : '');
    if (txt) txt.textContent = text || (status ? 'BAĞLANTI VAR' : 'BAĞLANTI YOK');
    // Detay: son paket ve ping (BÖLÜM 1)
    try {
      const health = this.bot.exchange?.getHealth?.();
      if (health) {
        if (detail) detail.textContent = `P:${health.lastSeen.ticker} D:${health.lastSeen.depth} K:${health.lastSeen.kline}`;
        if (lastmsg) {
          const now = Date.now();
          const last = this.bot.exchange.stream?.lastSeen?.any || 0;
          const ago = last ? Math.round((now - last)/1000) + 's önce' : '—';
          lastmsg.textContent = `son: ${ago}`;
        }
        if (packets && this.bot.exchange.stream?.packetCounts) {
          const pc = this.bot.exchange.stream.packetCounts;
          packets.textContent = `${pc.received || 0} pkt`;
        }
      }
    } catch(_){}
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

  /** Panteon paneli (5 elçi — DOM'da sadece 3 varsa gracefully degrade) */
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

  /** Kehanet paneli — Faz C: mtf parametresi eklendi */
  updateKehanet({ session, regime, pulse, guardian, mtf }) {
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('kp-session', session);
    set('kp-regime', regime);
    set('kp-pulse', pulse);
    set('kp-guardian', guardian);
    if (mtf !== undefined) set('kp-mtf', mtf);
  }

  updateCandleCountdown(secs) {
    const el = $('candle-countdown');
    if (el) el.textContent = secs > 0 ? `⏳ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '--:--';
  }

  setView(view) {
    // Alt nav aktif durumu
    document.querySelectorAll('#chart-view-btn, #heatmap-view-btn, #mobile-chart-view-btn, #mobile-heatmap-view-btn').forEach(btn => {
      btn.classList.remove('active');
      if ((view === 'chart' && btn.id.includes('chart')) || (view === 'heatmap' && btn.id.includes('heatmap'))) {
        btn.style.borderColor = 'var(--primary)';
        btn.style.background = 'var(--hover-bg)';
      } else {
        btn.style.borderColor = '';
        btn.style.background = '';
      }
    });
    STATE.activeView = view;
    const chartView = $('chart-container-view');
    const heatView = $('heatmap-container-view');
    if (chartView) chartView.style.display = view === 'chart' ? '' : 'none';
    if (heatView) heatView.style.display = view === 'heatmap' ? '' : 'none';
    if (view === 'chart') setTimeout(() => this.bot.chartManager?.resize(), 50);
    if (view === 'heatmap') this.bot.heatmapManager?.resize();
  }

  toggleHeader() {
    try {
      document.body.classList.toggle('header-collapsed');
      STATE.headerCollapsed = document.body.classList.contains('header-collapsed');
      this.bot.saveData('utc_header_collapsed', String(STATE.headerCollapsed));
      setTimeout(() => this.bot.chartManager?.resize(), 350);
    } catch (e) {
      console.error('toggleHeader hatası', e);
      document.body.classList.toggle('header-collapsed');
    }
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

  // ── Faz C: Strateji Performans Paneli ────────────────
  renderStrategyPerformance() {
    const tbody = $('strategy-performance-body');
    if (!tbody) return;
    const stats = this.bot.strategyStats || STATE.strategyStats || {};
    const keys = this.bot.strategyKeys || Object.keys(stats);
    
    const rows = keys.map((key) => {
      const s = stats[key]?.overall || { wins:0, losses:0, contrib:0, alpha:3, beta:2 };
      const inst = this.bot.strategies?.[key];
      const displayName = inst?.displayName || key;
      const ambassador = this.bot.strategyAmbassadors?.[key]?.ambassador || '-';
      const total = (s.wins||0) + (s.losses||0);
      const wr = total > 0 ? ((s.wins/total)*100).toFixed(1) : '—';
      const weight = this.bot.getStrategyWeight ? this.bot.getStrategyWeight(key).toFixed(2) : '-';
      const live = inst?._isLive !== false ? '🟢 Canlı' : '🌑 Gölge';
      const contrib = s.contrib || 0;
      // Renk: WR >=55 yeşil, >=45 sarı, düşük kırmızı
      const wrNum = total>0 ? (s.wins/total*100) : 0;
      const wrColor = wrNum >=55 ? 'var(--positive)' : wrNum >=45 ? 'var(--neutral)' : 'var(--negative)';
      return `<tr>
        <td title="${key}">${displayName}</td>
        <td style="font-size:9px;">${ambassador}</td>
        <td style="color:${wrColor}; font-weight:700;">${wr}${total>0?'%':''}</td>
        <td>${s.wins||0}/${s.losses||0}</td>
        <td>${contrib}</td>
        <td>${weight}</td>
        <td style="font-size:10px;">${live}</td>
      </tr>`;
    }).join('');

    // Sırala: contrib'e göre azalan (en çok katkı veren üstte)
    // Şimdilik keys sırasını koruyoruz, kullanıcı isterse tabloda sort eklenebilir
    tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">Veri yok</td></tr>';

    // Özet: en iyi / en kötü strateji
    if (keys.length) {
      const sorted = keys
        .map(k => ({ k, s: stats[k]?.overall || {wins:0,losses:0} }))
        .filter(x => (x.s.wins+x.s.losses)>0)
        .sort((a,b) => (b.s.wins/(b.s.wins+b.s.losses||1)) - (a.s.wins/(a.s.wins+a.s.losses||1)));
      if (sorted.length) {
        // console log için, ileride kehanet paneline de yazılabilir
      }
    }
  }

  updateReputationCard() {
    const mem = this.bot.tradingSystemMemory;
    if (!mem) return;
    const scoreEl = $('ai-rep-score');
    const levelEl = $('ai-rep-level');
    const historyEl = $('ai-rep-history');
    const deltaEl = $('ai-rep-delta');
    if (scoreEl) scoreEl.textContent = mem.reputation.score;
    if (levelEl) {
      levelEl.textContent = mem.reputation.level;
      const colors = { 'Efsane': 'var(--positive)', 'Usta': '#8b5cf6', 'Acemi Tacir': 'var(--primary)', 'Çaylak': 'var(--neutral)', 'Acemi': 'var(--negative)' };
      levelEl.style.color = colors[mem.reputation.level] || 'var(--text-secondary)';
    }
    if (historyEl) {
      const hist = mem.reputation.history.slice(-10);
      historyEl.innerHTML = hist.map(h => {
        const col = h.delta > 0 ? 'var(--positive)' : h.delta < 0 ? 'var(--negative)' : 'var(--neutral)';
        const icon = h.delta > 0 ? '▲' : h.delta < 0 ? '▼' : '●';
        return `<span style="color:${col}; font-size:10px;" title="${new Date(h.time).toLocaleTimeString()} ${h.delta>0?'+'+h.delta:h.delta} ${h.result}">${icon}</span>`;
      }).join('') || '<span style="color:var(--text-secondary); font-size:9px;">Henüz yok</span>';
    }
    if (deltaEl) {
      const last = mem.reputation.history[mem.reputation.history.length-1];
      if (last) deltaEl.textContent = `Son: ${last.delta>0?'+'+last.delta:last.delta} (${last.result})`;
      else deltaEl.textContent = '';
    }
  }

  renderPaternExperiences() {
    const tbody = $('patern-experiences-body');
    if (!tbody) return;
    const mem = this.bot.tradingSystemMemory;
    if (!mem || !mem.paternExperiences || mem.paternExperiences.size === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">Henüz deneyim yok — sinyal üretildikçe dolacak</td></tr>';
      return;
    }
    const rows = Array.from(mem.paternExperiences.entries())
      .map(([patern, exp]) => ({ patern, ...exp }))
      .sort((a,b) => b.successRate - a.successRate);
    tbody.innerHTML = rows.map(exp => {
      const wrColor = exp.successRate >= 60 ? 'var(--positive)' : exp.successRate >= 45 ? 'var(--neutral)' : 'var(--negative)';
      const lastSeen = exp.lastSeen ? new Date(exp.lastSeen).toLocaleTimeString('tr-TR') : '-';
      const avgProfit = exp.averageProfitPercent !== undefined ? exp.averageProfitPercent.toFixed(2) + '%' : '-';
      const avgHold = exp.averageHoldDuration ? (exp.averageHoldDuration/60).toFixed(1) + 'dk' : '-';
      const maxDD = exp.maxDrawdown !== undefined ? exp.maxDrawdown.toFixed(2) + '%' : '-';
      const ddColor = exp.maxDrawdown < -1 ? 'var(--negative)' : 'var(--text-secondary)';
      return `<tr>
        <td style="font-size:9px; max-width:140px; overflow:hidden; text-overflow:ellipsis;" title="${exp.patern}">${exp.patern.slice(0,24)}</td>
        <td>${exp.totalPredictions}</td>
        <td style="color:var(--positive)">${exp.successCount}</td>
        <td style="color:${wrColor}; font-weight:700;">${exp.successRate.toFixed(1)}%</td>
        <td style="font-size:10px;">${avgProfit}</td>
        <td style="font-size:10px;">${avgHold}</td>
        <td style="color:${ddColor}; font-size:10px;">${maxDD}</td>
        <td style="font-size:9px;">${lastSeen}</td>
      </tr>`;
    }).join('');
  }

  exportStrategyCSV() {
    const stats = this.bot.strategyStats || {};
    const keys = this.bot.strategyKeys || Object.keys(stats);
    let csv = 'Strateji,Elci,WR,Wins,Losses,Contrib,Weight,Durum\n';
    for (const key of keys) {
      const s = stats[key]?.overall || { wins:0,losses:0,contrib:0 };
      const ambassador = this.bot.strategyAmbassadors?.[key]?.ambassador || '';
      const total = (s.wins||0)+(s.losses||0);
      const wr = total>0 ? ((s.wins/total)*100).toFixed(1) : '';
      const weight = this.bot.getStrategyWeight ? this.bot.getStrategyWeight(key).toFixed(2) : '';
      const live = this.bot.strategies?.[key]?._isLive !== false ? 'Canli' : 'Golge';
      const name = this.bot.strategies?.[key]?.displayName || key;
      csv += `"${name}","${ambassador}","${wr}","${s.wins||0}","${s.losses||0}","${s.contrib||0}","${weight}","${live}"\n`;
    }
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `komist-strateji-performans-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.bot.notify?.success('Strateji CSV indirildi');
  }

  // ── Faz C: Sinyal Geçmişi Filtre + Export ────────────
  _getFilteredSignals(signals) {
    const f = this.signalFilters;
    return signals.filter(s => {
      if (f.direction && s.direction !== f.direction) return false;
      if (f.status && s.status !== f.status) return false;
      if (f.symbol && !(s.symbol || '').includes(f.symbol)) return false;
      return true;
    });
  }

  renderSignals(signals) {
    const tbody = $('signal-history-body');
    if (!tbody) return;
    
    const filtered = this._getFilteredSignals(signals);
    const info = $('signal-filter-info');
    if (info) {
      if (filtered.length !== signals.length) {
        info.textContent = `${filtered.length}/${signals.length} gösteriliyor (filtre aktif)`;
      } else {
        info.textContent = `${signals.length} sinyal`;
      }
    }

    // Faz C: Strateji performansını da güncelle (her sinyal sonrası)
    // Debounce ile çağrılmak daha iyi ama şimdilik doğrudan
    if (signals.length !== this._lastSignalCount) {
      this._lastSignalCount = signals.length;
      // Modal açıksa performans tablosunu yenile
      const overlay = $('settings-modal-overlay');
      if (overlay?.classList.contains('visible')) {
        // Biraz gecikmeli yenile (modal performans)
        setTimeout(() => {
          this.renderStrategyPerformance();
          this.updateReputationCard();
          this.renderPaternExperiences();
        }, 100);
      }
    }

    tbody.innerHTML = filtered.slice(0, 50).map((s) => `
      <tr style="cursor:pointer" title="Tıkla: detay, Çift tıkla: TP/SL göster">
        <td>${(() => { try { return new Date(s.timestamp).toLocaleTimeString('tr-TR'); } catch(e) { try { return new Date(s.timestamp).toLocaleTimeString('en-US'); } catch { return new Date(s.timestamp).toISOString().slice(11,19); } } })()}</td>
        <td>${s.symbol || STATE.symbol}</td>
        <td>${s.direction?.toUpperCase() || '-'}</td>
        <td>${formatPrice(s.price)}</td>
        <td>${s.tp ? formatPrice(s.tp) : '-'}</td>
        <td>${s.sl ? formatPrice(s.sl) : '-'}</td>
        <td>${s.score?.toFixed(1) ?? '-'}</td>
        <td style="color:${s.status === 'tp' ? 'var(--positive)' : s.status === 'sl' ? 'var(--negative)' : s.status === 'active' ? 'var(--primary)' : 'var(--neutral)'}">${s.status || 'aktif'}</td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">Henüz sinyal yok</td></tr>';
  }

  exportSignalCSV() {
    const signals = this._getFilteredSignals(this.bot.signals || []);
    if (!signals.length) { this.bot.notify?.warning('Dışa aktarılacak sinyal yok'); return; }
    let csv = 'Zaman,Sembol,Yon,Fiyat,TP,SL,Skor,Durum,KapanisFiyati,Sebep\n';
    for (const s of signals) {
      const t = new Date(s.timestamp).toISOString();
      csv += `"${t}","${s.symbol||''}","${s.direction||''}","${s.price||''}","${s.tp||''}","${s.sl||''}","${s.score||''}","${s.status||''}","${s.closePrice||''}","${(s.reason||'').replace(/"/g,'""')}"\n`;
    }
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `komist-sinyaller-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.bot.notify?.success(`${signals.length} sinyal CSV indirildi`);
  }

  exportSignalJSON() {
    const signals = this._getFilteredSignals(this.bot.signals || []);
    if (!signals.length) { this.bot.notify?.warning('Dışa aktarılacak sinyal yok'); return; }
    const json = JSON.stringify(signals, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `komist-sinyaller-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.bot.notify?.success(`${signals.length} sinyal JSON indirildi`);
  }

  // ── Faz C: MTF Özet ──────────────────────────────────
  _drawSparkline(svgId, values, color) {
    const svg = $(svgId);
    if (!svg || !values.length) return;
    if (values.length === 1) {
      // Tek nokta için ortada yatay çizgi
      svg.innerHTML = `<line x1="0" y1="12" x2="80" y2="12" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />`;
      return;
    }
    const w = 80, h = 24;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values.map((v,i) => {
      const x = (i / (values.length-1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${isFinite(x) && isFinite(y) ? `${x},${y}` : `0,${h/2}`}`;
    }).join(' ');
    svg.innerHTML = `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />`;
  }

  updateMetrics(ratio, volumeSpike, topBids, topAsks) {
    const ratioEl = $('metric-ratio-value');
    const volEl = $('metric-volume-value');
    const bidsEl = $('top-bids-list');
    const asksEl = $('top-asks-list');
    if (ratioEl) {
      ratioEl.textContent = ratio !== null ? (ratio*100).toFixed(1) + '%' : '—';
      ratioEl.style.color = ratio > 0.55 ? 'var(--positive)' : ratio < 0.45 ? 'var(--negative)' : 'var(--neutral)';
    }
    if (volEl) {
      volEl.textContent = volumeSpike ? volumeSpike.toFixed(1) + 'x' : '—';
      volEl.style.color = volumeSpike > 5 ? 'var(--positive)' : volumeSpike > 2 ? 'var(--neutral)' : 'var(--text-secondary)';
    }
    // Sparkline için history tut
    if (!this._ratioHistory) this._ratioHistory = [];
    if (!this._volHistory) this._volHistory = [];
    if (ratio !== null) {
      this._ratioHistory.push(ratio);
      if (this._ratioHistory.length > 20) this._ratioHistory.shift();
      this._drawSparkline('metric-ratio-sparkline', this._ratioHistory, ratio > 0.55 ? '#3ddc97' : ratio < 0.45 ? '#ff4d4f' : '#ffa500');
    }
    if (volumeSpike !== null) {
      this._volHistory.push(volumeSpike);
      if (this._volHistory.length > 20) this._volHistory.shift();
      this._drawSparkline('metric-volume-sparkline', this._volHistory, volumeSpike > 5 ? '#3ddc97' : '#ffa500');
    }
    // Top bids/asks with percentage bars
    if (bidsEl && topBids) {
      const totalBidVol = topBids.reduce((s,[,q])=>s+q,0) || 1;
      bidsEl.innerHTML = topBids.map(([p,q]) => {
        const pct = (q/totalBidVol*100).toFixed(0);
        return `<li style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid var(--border-color);">
          <span>${p.toFixed(2)} <span style="color:var(--text-secondary);">${q.toFixed(4)}</span></span>
          <span style="background:var(--positive); height:4px; width:${pct}%; display:inline-block; border-radius:2px; vertical-align:middle; margin-left:6px;"></span>
          <span style="font-size:9px; color:var(--text-secondary);">${pct}%</span>
        </li>`;
      }).join('');
    }
    if (asksEl && topAsks) {
      const totalAskVol = topAsks.reduce((s,[,q])=>s+q,0) || 1;
      asksEl.innerHTML = topAsks.map(([p,q]) => {
        const pct = (q/totalAskVol*100).toFixed(0);
        return `<li style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid var(--border-color);">
          <span>${p.toFixed(2)} <span style="color:var(--text-secondary);">${q.toFixed(4)}</span></span>
          <span style="background:var(--negative); height:4px; width:${pct}%; display:inline-block; border-radius:2px; vertical-align:middle; margin-left:6px;"></span>
          <span style="font-size:9px; color:var(--text-secondary);">${pct}%</span>
        </li>`;
      }).join('');
    }
  }

  updateMtfDisplay() {
    const el = $('kp-mtf');
    if (!el || !this.bot.multiTimeframeManager) return;
    
    const tfList = ['5m','15m','1h','4h'];
    const icons = { up: '↑', down: '↓', neutral: '→', unknown: '?' };
    const colors = { up: 'var(--positive)', down: 'var(--negative)', neutral: 'var(--neutral)', unknown: 'var(--text-secondary)' };
    
    const parts = tfList.map(tf => {
      const trend = this.bot.multiTimeframeManager.getTrend(tf);
      const icon = icons[trend] || '?';
      const color = colors[trend] || 'var(--text-secondary)';
      return `<span style="color:${color}">${tf}:${icon}</span>`;
    });
    
    el.innerHTML = parts.join(' ');
    
    // Tooltip için detay
    const summary = this.bot.multiTimeframeManager.getSummary?.() || '';
    el.title = summary + ' (EMA20 bazlı)';
  }
}

export default UIController;
