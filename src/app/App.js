/**
 * App.js — UltimateTerminal (orchestrator)
 * BOZOK PRO mikroyapı + UTC strateji/confluence/panteon sistemlerinin
 * tek noktada bağlanması. EventBus üzerinden tüm modülleri besler.
 *
 * Döngüler:
 *  250ms  → flow.tick + paper.update + render
 *  1000ms → stale kontrol + ui.updateStatus
 *  5000ms → signal decay, strateji periodicAnalyze, oracle, oto-toggle, kill switch
 *  60000ms→ panteon durgunluk
 */
import { EventBus } from '../core/EventBus.js';
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { Logger } from '../core/Logger.js';
import { pushCap, now } from '../core/Utils.js';

import { MicrostructureEngine } from '../engines/MicrostructureEngine.js';
import { TradeEngine } from '../engines/TradeEngine.js';
import { FlowEngine } from '../engines/FlowEngine.js';
import { SignalEngine } from '../engines/SignalEngine.js';
import { PaperTradingEngine } from '../engines/PaperTradingEngine.js';

import { DetectorSuite } from '../detectors/DetectorSuite.js';

import { createStrategies } from '../strategies/index.js';
import { STRATEGY_AMBASSADORS, STRATEGY_CLASSES } from '../strategies/index.js';

import { ConfluenceEngine } from '../confluence/ConfluenceEngine.js';
import { BayesianWeighting } from '../confluence/BayesianWeighting.js';
import { MultiTimeframeManager } from '../confluence/MultiTimeframeManager.js';

import { RiskGuardian } from '../risk/RiskGuardian.js';
import { PositionManager } from '../risk/PositionManager.js';
import { CUSUMDriftDetector } from '../risk/CUSUMDriftDetector.js';

import { PantheonManager } from '../panteon/PantheonManager.js';
import { TheOracle } from '../panteon/TheOracle.js';
import { PantheonEffects } from '../panteon/PantheonEffects.js';

import { ExchangeManager } from '../data/ExchangeManager.js';

import { RenderEngine } from '../render/RenderEngine.js';
import { UIController } from '../ui/UIController.js';
import { SignalFeed } from '../ui/SignalFeed.js';
import { TtsService } from '../ui/TtsService.js';

import { StorageService } from '../storage/StorageService.js';
import { StorageBridge } from '../storage/StorageBridge.js';
import { Migration } from '../storage/Migration.js';

export class UltimateTerminal {
  constructor() {
    // ── Altyapı ─────────────────────────────────────────
    this.bus = new EventBus();
    this.storage = new StorageService();
    this.bridge = new StorageBridge(this.storage);
    this.settings = { features: {}, optimization: CONFIG.optimization, cooldowns: CONFIG.confluence };
    this.shadowProposals = [];

    // ── Motorlar ────────────────────────────────────────
    this.micro = new MicrostructureEngine(this.bus);
    this.trade = new TradeEngine(this.bus);
    this.flow = new FlowEngine(this.bus);
    this.signalEngine = new SignalEngine(this.bus);
    this.paper = new PaperTradingEngine(this.bus);

    // ── Dedektörler ─────────────────────────────────────
    this.detectors = new DetectorSuite(this.bus);

    // ── Strateji + Confluence ───────────────────────────
    this.strategies = createStrategies(this);
    this.strategyStats = {};
    this.confluenceEngine = new ConfluenceEngine(this);
    this.bayes = new BayesianWeighting(this);
    this.mtf = new MultiTimeframeManager(this);

    // ── Risk ────────────────────────────────────────────
    this.riskGuardian = new RiskGuardian(this);
    this.positionManager = new PositionManager(this);
    this.cusumDetector = new CUSUMDriftDetector();

    // ── Panteon ─────────────────────────────────────────
    this.pantheon = new PantheonManager(this);
    this.oracle = new TheOracle(this);
    this.effects = new PantheonEffects();

    // ── Veri / Render / UI ──────────────────────────────
    this.exchange = new ExchangeManager(this.bus, { micro: this.micro, trade: this.trade });
    this.render = new RenderEngine(this.bus);
    this.ui = null;
    this.signalFeed = null;
    this.tts = new TtsService();

    // ── Durum ───────────────────────────────────────────
    this.isRunning = false;
    this.timers = [];
    this.marketData = STATE.marketData;
    this.orderBook = STATE.book;
    this.candles = STATE.candles;
    this.aggTrades = STATE.trades;

    this._wireBus();
  }

  // ── EventBus kablolama ───────────────────────────────
  _wireBus() {
    this.bus.on('book:update', () => {
      this.detectors.run();
      this._dispatchBookToStrategies();
      this.flow.tick();
      this.paper.update();
    });
    this.bus.on('trade:update', (t) => {
      this.flow.updateBucket(t);
      this._updateCandles(t);
      this._dispatchTradeToStrategies(t);
      this.detectors.onTrade();
    });
    this.bus.on('signal:add', (sig) => {
      const s = this.signalEngine.addSignal(sig);
      if (s) this._onNewSignal(s);
    });
    this.bus.on('paper:close', ({ position, reason }) => {
      const isWin = reason.startsWith('tp');
      this.pantheon.onSignalResult({
        status: isWin ? 'tp' : 'sl',
        contributors: position.contributors || []
      });
      // Bayes güncelle
      for (const key of position.contributors || []) {
        this.bayes.recordResult(key, isWin);
      }
      // CUSUM
      if (this.cusumDetector.update(isWin)) {
        Logger.warn('CUSUM', 'Kötü drift tespit — strateji havuzu gözden geçirilsin');
      }
      // Efekt + TTS
      if (isWin) this.effects.tpCelebrate();
      else this.effects.slExplosion();
      if (CONFIG.voiceAnnounce) {
        this.tts.speak(isWin ? 'Kâr alındı' : 'Stop çalıştı');
      }
    });
  }

  // ── Strateji dağıtımı ────────────────────────────────
  _dispatchTradeToStrategies(trade) {
    for (const key of Object.keys(this.strategies)) {
      try { this.strategies[key].processTrade?.(trade); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
  }

  _dispatchBookToStrategies() {
    for (const key of Object.keys(this.strategies)) {
      try { this.strategies[key].analyzeOrderBook?.(STATE.book); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
  }

  // ── Mum yönetimi (trade-driven 1m) ───────────────────
  _updateCandles(trade) {
    const tf = 60000;
    const t = trade.ts || now();
    let last = this.candles.at(-1);

    if (!last || t - last.time >= tf) {
      if (last) last.isClosed = true;
      this.candles.push({
        time: Math.floor(t / tf) * tf,
        open: trade.price, high: trade.price, low: trade.price,
        close: trade.price, volume: trade.qty, isClosed: false
      });
      if (this.candles.length > 300) this.candles.splice(0, this.candles.length - 300);
    } else {
      last.high = Math.max(last.high, trade.price);
      last.low = Math.min(last.low, trade.price);
      last.close = trade.price;
      last.volume = (last.volume || 0) + trade.qty;
    }
    STATE.candles = this.candles;
  }

  // ── Yeni sinyal yan etkileri ─────────────────────────
  _onNewSignal(signal) {
    this.effects.buyBurst();
    if (CONFIG.voiceAnnounce) {
      const dir = signal.bias === 'bullish' ? 'Alım' : signal.bias === 'bearish' ? 'Satım' : 'Uyarı';
      this.tts.speak(`${dir} sinyali: ${signal.type}`);
    }
    this.storage.saveSignal(signal);
  }

  // ── Start / Stop ─────────────────────────────────────
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.storage.initIndexedDB();
    await Migration.runOnce(this.storage);
    await this.bridge.init();

    this._loadSettings();
    this.pantheon.load(this.storage.getJsonSync('utc_panteon'));

    this.ui = new UIController(this.bus, { app: this });
    this.signalFeed = new SignalFeed('signalList');

    this._registerCanvases();
    this.ui.switchTab(STATE.activeTab || 'book');

    this.marketData.symbol = STATE.symbol;
    await this.exchange.connect(STATE.symbol);
    this.mtf.initialize(STATE.symbol);
    this._fetchKlines(STATE.symbol);

    this._startLoops();
    Logger.info('App', 'Terminal başladı ✔');
  }

  stop() {
    this.isRunning = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.exchange.disconnect();
    this.mtf.cleanup();
    this.render.stopLoop();
  }

  _registerCanvases() {
    this.render.registerCanvas('book-canvas', 'book');
    this.render.registerCanvas('flow-canvas', 'flow');
    this.render.registerCanvas('cvd-canvas', 'cvd');
    this.render.registerCanvas('equity-canvas', 'equity');
    this.render.registerCanvas('chart-canvas', 'chart');
  }

  _startLoops() {
    // rAF render döngüsü
    this.render.startLoop();

    const every = (ms, fn) => {
      const id = setInterval(() => { if (this.isRunning) fn(); }, ms);
      this.timers.push(id);
    };

    every(250, () => {
      this.flow.tick();
      this.paper.update();
    });
    every(1000, () => {
      STATE.stale = now() - STATE.lastBookUpdate > CONFIG.staleThresholdMs && STATE.lastBookUpdate > 0;
      this.ui?.updateStatus();
    });
    every(5000, () => {
      this.signalEngine.applyDecay();
      this.ui?.updateSignalBadge();
      this.signalFeed?.render();
      this._periodicAnalyze();
      this.oracle.detect();
      this.bayes.autoToggleStrategies();
      this.riskGuardian.checkKillSwitch();
      this.ui?.renderPerf();
    });
    every(60000, () => {
      this.pantheon.checkInactivity();
      this._fetchKlines(STATE.symbol);
    });
  }

  _periodicAnalyze() {
    for (const key of Object.keys(this.strategies)) {
      try { this.strategies[key].periodicAnalyze?.(); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
  }

  // ── Kline (REST) ─────────────────────────────────────
  async _fetchKlines(symbol) {
    try {
      const res = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=200`,
        { signal: AbortSignal.timeout(8000) }
      );
      const raw = await res.json();
      if (Array.isArray(raw)) {
        this.candles = raw.map((d) => ({
          time: d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4],
          volume: +d[5], isClosed: true
        }));
        STATE.candles = this.candles;
        this._updateIndicators();
      }
    } catch (e) {
      Logger.debug('Kline', 'alınamadı:', e.message);
    }
  }

  _updateIndicators() {
    const closes = this.candles.map((c) => c.close);
    STATE.indicators.lastClose = closes.at(-1);
    STATE.indicators.sma20 = closes.length >= 20
      ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
    STATE.marketRegime = 'unknown';
  }

  // ── Sembol değiştirme ────────────────────────────────
  changeSymbol(symbol) {
    STATE.symbol = symbol;
    this.marketData.symbol = symbol;
    this.candles = [];
    STATE.candles = [];
    this.exchange.connect(symbol);
    this.mtf.initialize(symbol);
    this._fetchKlines(symbol);
    this.saveSettings();
  }

  // ── Confluence sinyali ───────────────────────────────
  onConfluenceSignal(direction, score, reason, contributors) {
    // Atlı engeli: SALGIN'da sinyaller durur (kaynak: UTC §14)
    if (this.oracle.horseman === 'SALGIN') {
      Logger.warn('Oracle', 'SALGIN atlısı aktif — sinyal engellendi');
      return;
    }
    // MTF bilgelik faktörü
    const finalScore = this.mtf.applyWisdom(direction, score);

    const signal = this.signalEngine.addSignal({
      type: 'CONFLUENCE_SIGNAL',
      bias: direction === 'buy' ? 'bullish' : 'bearish',
      confidence: Math.round(Math.min(95, 50 + finalScore * 4)),
      description: `Confluence: ${reason} (skor ${finalScore.toFixed(1)})`,
      price: STATE.lastPrice,
      evidence: { score: finalScore, contributors: contributors.map((c) => c.strategy) }
    });

    if (signal) {
      this.effects.buyBurst();
      if (CONFIG.voiceAnnounce) {
        this.tts.speak(direction === 'buy' ? 'Uzun pozisyon sinyali' : 'Kısa pozisyon sinyali');
      }
      // Plan + paper trading (addSignal zaten generateTradePlan çağırır)
      if (STATE.tradePlan && STATE.tradePlan.direction !== 'NEUTRAL') {
        const plan = STATE.tradePlan;
        plan.contributors = contributors.map((c) => c.strategy);
        this.paper.simulateFromPlan(plan);
      }
    }
  }

  onHorsemanChange(horseman) {
    this.effects.horsemanFlash(horseman);
    this.bus.emit('horseman:change', horseman);
    if (CONFIG.voiceAnnounce) {
      const msg = {
        SAVAŞ: 'SAVAŞ atlısı ufukta!',
        KITLIK: 'KITLIK çöktü piyasaya...',
        SALGIN: 'SALGIN! Flash çöküş tespit edildi!',
        ÖLÜM: 'ÖLÜM atlısı geldi... Piyasa sustu.'
      }[horseman];
      if (msg) this.tts.speak(msg);
    }
  }

  onKillSwitch() {
    if (CONFIG.voiceAnnounce) {
      this.tts.speak('Dikkat! Sistem win rate düştü. Otomatik durduruldu.');
    }
  }

  onReputationChange() {
    // UI itibar güncellemesi (opsiyonel)
  }

  // ── Bayesian / Panteon arayüzleri ────────────────────
  getStrategyWeight(key) {
    return this.bayes.getWeight(key, STATE.marketRegime === 'unknown' ? 'overall' : STATE.marketRegime);
  }

  getModeRRMultiplier() {
    return this.pantheon.getRRMultiplier();
  }

  getEffectiveThreshold() {
    const base = this.settings.confluence?.threshold ?? CONFIG.confluence.threshold;
    const delta = this.pantheon._combinedThresholdDelta();
    const oracleOffset = this.oracle.getThresholdOffset();
    return base + delta + oracleOffset;
  }

  recordShadowProposal(key, direction, reason, score) {
    pushCap(this.shadowProposals, { key, direction, reason, score, ts: Date.now() }, 4000);
    const stats = this.strategyStats[key]?.overall;
    if (stats) {
      stats.shadowProposals = (stats.shadowProposals || 0) + 1;
      this.saveStrategyStats();
    }
  }

  shadowBanStrategy(key, weight) {
    const inst = this.strategies[key];
    if (!inst) return;
    inst.setIsLive(false);
    const stats = this.strategyStats[key]?.overall;
    if (stats) stats.lastShadowToggle = Date.now();
    Logger.info('Optimizer', `${key} gölgeye alındı (w=${weight.toFixed(2)})`);
  }

  rehabilitateStrategy(key, winRate) {
    const inst = this.strategies[key];
    if (!inst) return;
    inst.setIsLive(true);
    Logger.info('Optimizer', `${key} rehabilite edildi (gölge WR=${(winRate * 100).toFixed(0)}%)`);
  }

  // ── Kalıcılık ────────────────────────────────────────
  saveStrategyStats() {
    this.bridge.setJson('utc_strategy_stats', this.strategyStats);
  }

  savePanteonState() {
    this.bridge.setJson('utc_panteon', this.pantheon.serialize());
  }

  saveSettings() {
    const s = {
      symbol: STATE.symbol,
      theme: CONFIG.theme,
      soundOn: CONFIG.soundOn,
      voiceAnnounce: CONFIG.voiceAnnounce,
      activeLayers: STATE.activeLayers,
      flowMode: CONFIG.flowMode,
      flowTimeframeMs: CONFIG.flowTimeframeMs,
      riskPct: CONFIG.riskPct,
      maxLeverage: CONFIG.maxLeverage
    };
    this.storage.saveSettings(s);
  }

  _loadSettings() {
    const s = this.storage.loadSettings();
    if (!s) return;
    if (s.symbol) STATE.symbol = s.symbol;
    if (s.theme) this.setTheme(s.theme);
    if (typeof s.soundOn === 'boolean') CONFIG.soundOn = s.soundOn;
    if (typeof s.voiceAnnounce === 'boolean') CONFIG.voiceAnnounce = s.voiceAnnounce;
    if (Array.isArray(s.activeLayers)) STATE.activeLayers = s.activeLayers;
    if (s.flowMode) CONFIG.flowMode = s.flowMode;
    if (s.flowTimeframeMs) CONFIG.flowTimeframeMs = s.flowTimeframeMs;
    if (s.riskPct) CONFIG.riskPct = s.riskPct;
    if (s.maxLeverage) CONFIG.maxLeverage = s.maxLeverage;
    this.effects.setEnabled({ sound: CONFIG.soundOn });
    this.tts.setEnabled(CONFIG.voiceAnnounce);
  }

  setTheme(theme) {
    CONFIG.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach((el) => {
      el.classList.toggle('active', el.dataset.themeOption === theme);
    });
    this.saveSettings();
  }

  onSettingChange(key, value) {
    if (key === 'soundOn') this.effects.setEnabled({ sound: value });
    if (key === 'voiceAnnounce') this.tts.setEnabled(value);
  }

  getStrategyMeta() {
    return Object.fromEntries(
      Object.entries(STRATEGY_AMBASSADORS).map(([k, v]) => [k, v.ambassador])
    );
  }
}

export default UltimateTerminal;
