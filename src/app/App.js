/**
 * App.js — UltimateTradingCommandCenter (ana sınıf)
 * Kaynak: barva35.html — UltimateTradingCommandCenter (modülerleştirilmiş)
 *
 * Sorumluluklar:
 *  - Modüllerin kurulumu (strateji, confluence, risk, panteon, render, UI, depolama)
 *  - WebSocket veri akışı (ticker/depth/kline/aggTrade)
 *  - Sinyal yaşam döngüsü: confluence → pending → aktif → TP/SL sonucu
 *  - Ayarlar + kalıcılık, tema, sembol/timeframe değişimi
 */
import { CONFIG, DEFAULT_SETTINGS } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { Logger } from '../core/Logger.js';
import { debounce, formatPrice, formatVolume, pushCap } from '../core/Utils.js';

import { STRATEGY_CLASSES, STRATEGY_AMBASSADORS, STRATEGY_GROUPS, createStrategies } from '../strategies/index.js';
import { ConfluenceEngine } from '../confluence/ConfluenceEngine.js';
import { RiskGuardian } from '../risk/RiskGuardian.js';
import { SpoofDetector } from '../risk/SpoofDetector.js';
import { SessionProfiler } from '../risk/SessionProfiler.js';
import { CUSUMDriftDetector } from '../risk/CUSUMDriftDetector.js';
import { PositionManager } from '../risk/PositionManager.js';
import { PantheonManager } from '../panteon/PantheonManager.js';
import { MultiTimeframeManager } from '../confluence/MultiTimeframeManager.js';
import { ExchangeManager } from '../data/ExchangeManager.js';
import { BinanceStream } from '../data/BinanceStream.js';
import { BybitStream } from '../data/BybitStream.js';
import { OKXStream } from '../data/OKXStream.js';

const EXCHANGE_STREAMS = {
  binance: BinanceStream,
  bybit: BybitStream,
  okx: OKXStream
};
import { ChartManager } from '../render/ChartManager.js';
import { HeatmapManager } from '../render/HeatmapManager.js';
import { TieredOrderBook } from '../render/TieredOrderBook.js';
import { EffectsManager } from '../render/EffectsManager.js';
import { UIController } from '../ui/UIController.js';
import { NotificationService } from '../ui/NotificationService.js';
import { TtsService } from '../ui/TtsService.js';
import { DBManager } from '../storage/DBManager.js';
import { StorageBridge } from '../storage/StorageBridge.js';
import { Migration } from '../storage/Migration.js';

import { rsi } from '../indicators/RSI.js';
import { atr } from '../indicators/ATR.js';
import { sma } from '../indicators/SMA.js';
import { ema } from '../indicators/EMA.js';
import { adx } from '../indicators/ADX.js';
import { vwap } from '../indicators/VWAP.js';
import { bollinger } from '../indicators/Bollinger.js';
import { CVD } from '../indicators/CVD.js';
import { ApiQueue } from '../core/ApiQueue.js';
import { PaperTrading } from '../paper/PaperTrading.js';

// NOT: WatchlistManager / BacktestEngine (TradingCore ayrımı) / CloudSyncManager (Firebase/Telegram)
// 10.08.2026 tarihinde proje sahibi tarafından açıkça REDDEDİLDİ — bir daha teklif edilmemeli
// Gerekçe: replay/simülasyon/mock veri saçmalıkları istenmiyor
// Bu not hem kodda hem README'de düşülmüştür


const safeClone = (obj) => {
  try { return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }
  catch { return JSON.parse(JSON.stringify(obj)); }
};

export class UltimateTradingCommandCenter {
  constructor() {
    // ── UI EN ÖNCE: hiçbir manager throw etse bile butonlar çalışsın (barva35 referansı: setupEventListeners hep çalışır) ──
    // UIController'ı en başta oluşturuyoruz ki DOM event'leri hemen bağlansın, App constructor geri kalanı throw etse bile UI ayakta kalsın
    let _uiEarly = null;
    try {
      // Geçici bot referansı ile UI'ı hemen bağla (bot henüz tam hazır değil ama _bindStatic sadece DOM'a bakar)
      _uiEarly = null;
    } catch(_) {}

    // ── Kalıcılık altyapısı ─────────────────────────────
    this.db = new DBManager();
    this.storage = new StorageBridge(this.db);

    // ── Ayarlar & durum ────────────────────────────────
    // NOT: storage henüz ready değil (async init'te yüklenecek), burada sadece default kullan
    this.settings = safeClone(DEFAULT_SETTINGS);
    // StorageBridge ready olmadan getJsonSync hep null döner -> default kullan, init() içinde gerçek değer yüklenecek
    this.currentSymbol = CONFIG.defaultSymbol;
    this.currentTimeframe = CONFIG.defaultTimeframe;
    this.currentExchange = CONFIG.defaultExchange || 'binance';
    this.headerCollapsed = true;
    this.currentMainView = 'chart';
    this.runtimeThresholdOffset = 0;
    this.slippageHighUntil = 0;

    // ── Piyasa verisi ──────────────────────────────────
    this.marketData = { price: 0, change24h: 0, volume24h: 0, symbol: this.currentSymbol, btcPrice: 70000 };
    this.symbolInfo = { pricePrecision: 2, quantityPrecision: 6, tickSize: 0.01, stepSize: 0.001, baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' };
    this.orderBook = { bids: [], asks: [], lastUpdateId: null };
    this.candles = [];
    this.indicators = { rsi: [], atr: null, sma20: null, sma50: null, volSma20: null, vwap: null, adx: null, bbands: null };

    // ── Strateji haritaları (barva35) ──────────────────
    // ÖNCE haritalar tanımlanmalı ki initDefaultStrategyStats() içinde kullanılabilsin (Faz C fix)
    this.strategyAmbassadors = STRATEGY_AMBASSADORS;
    this.strategyGroups = STRATEGY_GROUPS;
    this.strategyKeys = Object.keys(STRATEGY_CLASSES);

    // ── Sinyaller & istatistikler ──────────────────────
    this.signals = [];
    this.pendingSignals = [];
    this.stats = { total: 0, tp: 0, sl: 0 };
    // strategyStats storage ready olmadan okunamaz -> default init, gerçek veri async init() içinde yüklenecek
    this.strategyStats = this.initDefaultStrategyStats();
    this.shadowProposals = [];
    this.marketRegime = 'unknown';
    // Yapay Zeka Hafızası (senin Madde 1)
    this.tradingSystemMemory = {
      paternExperiences: new Map(),
      reputation: { score: 100, level: 'Acemi Tacir', history: [], lastUpdate: Date.now() },
      completedSignals: []
    };
    this.MAX_MEMORY_PENDING_SIGNALS = 100;
    this.MAX_MEMORY_REPUTATION_HISTORY = 50;
    this.MAX_COMPLETED_SIGNALS = 100;
    // REMOVED: this.positions = [] -> ölü sistem (Faz A #2). Pozisyon takibi signals üzerinden (checkAutoCloseSignals) yapılıyor.
    // PositionManager.manageOpenPositions() artık no-op / deprecated. Geriye dönük uyum için boş dizi bırakma, tamamen kaldırıldı.

    // ── Modüller ───────────────────────────────────────
    // CVD önce (stratejiler processTrade'de cvd'ye erişebilir)
    try { this.cvd = new CVD(500); } catch(e) { console.error('CVD init hatası', e); this.cvd = { update:()=>{}, getValue:()=>0, history:[], detectDivergence:()=>null }; }
    try { this.paperTrading = new PaperTrading(this); } catch(e) { console.error('PaperTrading hatası', e); this.paperTrading = { openPosition:()=>null, update:()=>{}, getStats:()=>({}), history:[], positions:[] }; }
    try { this.strategies = createStrategies(this); } catch(e) { console.error('Strategies init hatası', e); this.strategies = {}; }
    try { this.confluenceEngine = new ConfluenceEngine(this); } catch(e) { console.error('ConfluenceEngine hatası', e); }
    try { this.multiTimeframeManager = new MultiTimeframeManager(this); } catch(e) { console.error('MultiTimeframeManager hatası', e); }
    try { this.riskGuardian = new RiskGuardian(this); } catch(e) { console.error('RiskGuardian hatası', e); }
    try { this.spoofDetector = new SpoofDetector(this); } catch(e) { console.error('SpoofDetector hatası', e); }
    try { this.sessionProfiler = new SessionProfiler(); } catch(e) { console.error('SessionProfiler hatası', e); }
    try { this.cusumDetector = new CUSUMDriftDetector(); } catch(e) { console.error('CUSUM hatası', e); }
    try { this.positionManager = new PositionManager(this); } catch(e) { console.error('PositionManager hatası', e); }
    try { this.panteon = new PantheonManager(this); } catch(e) { console.error('Panteon hatası', e); }
    // panteon_state de async init() içinde yüklenecek (storage ready sonrası)

    try {
      const StreamClass = EXCHANGE_STREAMS[this.currentExchange] || BinanceStream;
      this.exchange = new ExchangeManager(this, StreamClass, this.currentExchange);
    } catch(e) { console.error('ExchangeManager hatası', e); this.exchange = new ExchangeManager(this, BinanceStream, 'binance'); }
    try { this.chartManager = new ChartManager('live-chart'); } catch(e) { console.error('ChartManager hatası', e); this.chartManager = { setData:()=>{}, updateRealtime:()=>{}, addSignalMarker:()=>{}, clearMarkers:()=>{}, resize:()=>{}, zoomIn:()=>{}, zoomOut:()=>{}, resetZoom:()=>{}, updateTheme:()=>{} }; }
    try { this.heatmapManager = new HeatmapManager('orderbook-heatmap'); } catch(e) { console.error('HeatmapManager hatası', e); this.heatmapManager = { draw:()=>{}, resize:()=>{} }; }
    try { this.tieredOrderBook = new TieredOrderBook('tiered-orderbook'); } catch(e) { console.error('TieredOrderBook hatası', e); this.tieredOrderBook = { render:()=>{}, clear:()=>{} }; }
    try { this.effects = new EffectsManager('effects-canvas'); } catch(e) { console.error('EffectsManager hatası', e); this.effects = { start:()=>{}, emit:()=>{}, stop:()=>{} }; }
    try { this.notify = new NotificationService('notifications-container'); } catch(e) { console.error('NotificationService hatası', e); this.notify = { info:console.log, warning:console.log, success:console.log, danger:console.log, show:console.log }; }
    try { this.tts = new TtsService(); } catch(e) { console.error('TtsService hatası', e); this.tts = { speak:()=>{}, getVoices:()=>[], setVoice:()=>{}, setEnabled:()=>{} }; }
    // UI EN SON DEĞIL EN GÜVENLİ: her şeyden sonra ama try/catch içinde, throw etse bile app ayakta kalsın
    try { this.ui = new UIController(this); } catch(e) { console.error('UIController hatası - KRİTİK', e); try { this.ui = new UIController(this); } catch(e2) { console.error('UIController 2. deneme de başarısız', e2); } }

    // ── Zamanlayıcılar ─────────────────────────────────
    this.renderInterval = null;
    this.analysisInterval = null;
    this.countdownInterval = null;
    this.performanceInterval = null;
    this.sessionInterval = null;
    this.evaluationInterval = null;
    this.dynamicThresholdInterval = null;
    this.apiQueue = new ApiQueue(200);
    this.isRunning = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 3000;

    this.buyScore = 0;
    this.sellScore = 0;
    this.combatModeActive = false;

    this.debouncedRender = debounce(() => this.render(), 250);
  }

  // ═════════════════════════════════════════════════════
  // BAŞLATMA / DURDURMA
  // ═════════════════════════════════════════════════════
  async init() {
    await this.db.init();
    await Migration.runOnce(this.db);
    await this.storage.init();

    // ── Faz A #7 + #8: Ayarlar & kalıcılık tek kaynak StorageBridge üzerinden ──
    // Constructor'da default yüklenmişti, şimdi storage ready -> gerçek kalıcı veriyi yükle
    const persistedSettings = this.storage.getJsonSync('utc_settings');
    if (persistedSettings) {
      this.settings = { ...safeClone(DEFAULT_SETTINGS), ...persistedSettings };
    }
    // Sembol/timeframe/borsa kalıcılığı (Faz A #8 + Faz D)
    this.currentSymbol = this.storage.getJsonSync('utc_current_symbol') || CONFIG.defaultSymbol;
    this.currentTimeframe = this.storage.getJsonSync('utc_current_timeframe') || CONFIG.defaultTimeframe;
    this.currentExchange = this.storage.getJsonSync('utc_current_exchange') || CONFIG.defaultExchange || 'binance';
    // Exchange'i seçili borsaya göre yeniden oluştur (constructor'daki default'u ez)
    try {
      const StreamClass = EXCHANGE_STREAMS[this.currentExchange] || BinanceStream;
      this.exchange = new ExchangeManager(this, StreamClass, this.currentExchange);
    } catch(e) { console.error('Exchange re-init hatası', e); }
    this.marketData.symbol = this.currentSymbol;
    STATE.symbol = this.currentSymbol;
    STATE.timeframe = this.currentTimeframe;
    STATE.exchange = this.currentExchange;
    STATE.symbolInfo = this.symbolInfo;
    // UI'daki borsa seçiciyi güncelle
    try { const sel = document.getElementById('exchange-select'); if (sel) sel.value = this.currentExchange; } catch(_){}

    // Sembol bilgisini al (tickSize hassasiyeti)
    try { await this.fetchSymbolInfo(this.currentSymbol); } catch(_){}

    // strategyStats kalıcılığı (Faz A #8)
    const persistedStats = this.storage.getJsonSync('utc_strategy_stats');
    if (persistedStats) this.strategyStats = persistedStats;

    // Yapay Zeka Hafızası yükle
    this.loadTradingSystemMemory();

    // Kalıcı sinyal/stats/pending geri yükle + STATE senkronizasyonu (Faz A #1 + Yapay Zeka Hafızası)
    this.signals = this.storage.getJsonSync('utc_signals') || [];
    this.pendingSignals = this.storage.getJsonSync('utc_pending_signals') || this.pendingSignals || [];
    this.stats = this.storage.getJsonSync('utc_stats') || { total: 0, tp: 0, sl: 0 };
    STATE.stats = { ...this.stats };
    STATE.signals = this.signals;
    // Faz A #2: positions ölü sistem kaldırıldı -> STATE.positions boş tutuluyor (geriye dönük uyum)
    STATE.positions = [];
    this.panteon.loadState(this.storage.getJsonSync('pantheon_state'));
    // Panteon modları yüklendikten sonra threshold/cooldown etkileri güncel kalsın
    STATE.strategyStats = this.strategyStats;

    // Patch #1: activeStrategies yoksa tüm stratejileri aktif yap (barva35 loadSettings mantığı)
    if (!this.settings.activeStrategies || Object.keys(this.settings.activeStrategies).length === 0) {
      this.settings.activeStrategies = {};
      for (const key of this.strategyKeys) this.settings.activeStrategies[key] = true;
    } else {
      // Eksik anahtarları tamamla (yeni strateji eklenmişse)
      for (const key of this.strategyKeys) {
        if (this.settings.activeStrategies[key] === undefined) this.settings.activeStrategies[key] = true;
      }
    }
    // statusMaps yoksa oluştur
    if (!this.settings.statusMaps) this.settings.statusMaps = { shadowBanned: {}, hardBanned: {} };
    if (!this.settings.statusMaps.shadowBanned) this.settings.statusMaps.shadowBanned = {};
    if (!this.settings.statusMaps.hardBanned) this.settings.statusMaps.hardBanned = {};
    // strategyParams yoksa oluştur
    if (!this.settings.strategyParams) this.settings.strategyParams = {};
    this.saveSettings();

    this.applyStrategyParamOverrides();

    document.body.classList.add('header-collapsed');
    // Yapay Zeka Hafızası UI ilk yükleme
    try { this.ui.updateReputationCard(); } catch(_){}
    try { this.ui.renderPaternExperiences(); } catch(_){}
    this.effects.start();
    this.updateSession();
    this.sessionInterval = setInterval(() => this.updateSession(), 60000);
    this.countdownInterval = setInterval(() => this.updateCandleCountdown(), 1000);
    this.startPerformanceMonitor();
    this.ui.renderSignals(this.signals);
    // Faz C: Strateji performans panelini ilk yüklemede doldur
    try { this.ui.renderStrategyPerformance(); } catch(_){}
    this.ui.setView(this.currentMainView);
    // Faz C: MTF özetini ilk yüklemede göster
    try { this.ui.updateMtfDisplay(); } catch(_){}
    this.showFirstLight();
    Logger.info('App', 'Komuta Merkezi hazır. SİSTEMİ BAŞLAT butonuna tıklayın.');
    this.notify.info('Sistem hazır — başlatmak için "SİSTEMİ BAŞLAT" de.');
    return this;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    Logger.info('App', 'Sistem başlatılıyor...');
    this.notify.info('Sistem başlatılıyor...');

    this.exchange.connect(this.currentSymbol, this.currentTimeframe);
    this.multiTimeframeManager.initialize(this.currentSymbol);

    // İlk veri: kline geçmişi
    this.exchange.fetchInitialData(this.currentSymbol, this.currentTimeframe).then((candles) => {
      if (candles.length) {
        this.candles = candles;
        this.chartManager.setData(candles);
        this.calculateAllIndicators();
      } else if (CONFIG.useMockFallback) {
        this.exchange.enableMock(this.currentSymbol);
      }
    });

    // Mock fallback: 8s içinde veri gelmediyse mock
    setTimeout(() => {
      if (this.isRunning && !STATE.marketData.price && CONFIG.useMockFallback) {
        this.exchange.enableMock(this.currentSymbol);
      }
    }, 8000);

    this.renderInterval = setInterval(() => this.render(), 500);
    this.analysisInterval = setInterval(() => this.runPeriodicAnalysis(), 5000);
    this.evaluationInterval = setInterval(() => this.evaluatePendingSignals(), 60 * 1000);
    if (this.settings.optimization.enabled) {
      this.paramTuneInterval = setInterval(() => this.autoTuneStrategyParams(), 5 * 60 * 1000);
      // BÖLÜM 2: Dinamik eşikler de 5dk'da bir güncellensin
      this.dynamicThresholdInterval = setInterval(() => this.updateDynamicThresholds(), 5 * 60 * 1000);
    }
    document.getElementById('start-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
  }

  stop() {
    this.isRunning = false;
    this.exchange.disconnect();
    this.multiTimeframeManager.cleanup();
    clearInterval(this.renderInterval);
    clearInterval(this.analysisInterval);
    if (this.evaluationInterval) clearInterval(this.evaluationInterval);
    if (this.paramTuneInterval) clearInterval(this.paramTuneInterval);
    if (this.dynamicThresholdInterval) clearInterval(this.dynamicThresholdInterval);
    this.ui.updateConnection(false, 'DURDURULDU');
    Logger.info('App', 'Sistem durduruldu');
    this.notify.warning('Sistem durduruldu.');
    const sb = document.getElementById('start-btn');
    const st = document.getElementById('stop-btn');
    if (sb) sb.disabled = false;
    if (st) st.disabled = true;
  }

  // ═════════════════════════════════════════════════════
  // VERİ AKIŞI (barva35 handleMarketData)
  // ═════════════════════════════════════════════════════
  onConnectionStatus(status, delay) {
    if (status === 'online') {
      this.ui.updateConnection(true, 'BAĞLANTI VAR');
    } else if (status === 'reconnecting') {
      const attempt = this.exchange?.stream?.publicAttempts || this.exchange?.stream?.marketAttempts || 0;
      this.ui.updateConnection(false, `YENİDEN BAĞLANILIYOR... (${Math.round(delay / 1000)}s) [${attempt}]`);
    } else {
      this.ui.updateConnection(false, 'BAĞLANTI YOK');
    }
    // Son mesaj zamanını güncelle (BÖLÜM 1)
    try { this._lastConnectionUpdate = Date.now(); } catch(_){}
  }

  handleMarketData(streamType, data) {
    if (!this.isRunning) return;
    try {
      if (streamType === 'ticker') this._applyTicker(data);
      else if (streamType === 'depth') this._applyOrderBook(data);
      else if (streamType.startsWith('kline')) this._applyKline(data);
      else if (streamType === 'aggTrade') this._processTrade(data);
      else if (streamType === 'forceOrder') this._processForceOrder(data);
      else if (streamType === 'markPrice') this._applyMarkPrice(data);
    } catch (e) {
      Logger.error('App', 'handleMarketData hatası:', e);
    }
  }

  _applyTicker(data) {
    const price = parseFloat(data.c);
    // Faz A #3: ZebaniFilter bad-tick filtresi — veri akışına bağlandı
    if (this.exchange?.zebani && !this.exchange.zebani.check(price)) {
      Logger.warn('Zebani', `Bad tick filtrelendi (ticker): ${price} — işlem yapılmadı`);
      return;
    }
    this.marketData.price = price;
    this.marketData.change24h = parseFloat(data.P);
    this.marketData.volume24h = parseFloat(data.q);
    this.marketData.symbol = data.s;
    if (data.s === 'BTCUSDT') this.marketData.btcPrice = price;
    STATE.marketData = this.marketData;
    // Paper trading update
    try { this.paperTrading.update(price); } catch(_){}
    // Faz A #2: PositionManager.manageOpenPositions() ölü kod -> kaldırıldı (signals üzerinden checkAutoCloseSignals kullanılıyor)
    // this.positionManager.manageOpenPositions(); // DEPRECATED
    this.checkAutoCloseSignals();
    this.ui.updateTicker();
    this.ui.updatePriceDisplay();
  }

  _applyOrderBook(data) {
    this.orderBook = {
      bids: (data.b || []).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      asks: (data.a || []).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      lastUpdateId: data.u
    };
    STATE.orderBook = this.orderBook;
    this.heatmapManager.draw(this.orderBook, this.marketData.price);
    try {
      const tickSize = this.symbolInfo?.tickSize || STATE.symbolInfo?.tickSize || 0.01;
      this.tieredOrderBook.render(this.orderBook, tickSize);
    } catch(_){}
    if (this.settings.features.enableSpoofDetection) this.spoofDetector.trackOrderBook(this.orderBook);
    for (const key of this.strategyKeys) {
      try { this.strategies[key]?.analyzeOrderBook?.(this.orderBook); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
  }

  _applyKline(data) {
    const k = data.k;
    if (!k) return;
    const candle = { time: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
    const last = this.candles[this.candles.length - 1];

    if (last && last.time === candle.time) this.candles[this.candles.length - 1] = candle;
    else this.candles.push(candle);
    if (this.candles.length > 501) this.candles.shift();

    this.chartManager.updateRealtime(k);

    if (k.x) { // Mum kapandı
      this.checkPendingSignals(candle);
      this.calculateAllIndicators();
    }
    // Faz A #2: manageOpenPositions deprecated -> kaldırıldı
    // this.positionManager.manageOpenPositions();
    this.checkAutoCloseSignals();
  }

  _processTrade(trade) {
    // Binance aggTrade formatı: p,q,m,T  — normalize et
    const price = parseFloat(trade.p ?? trade.price ?? 0);
    const qty = parseFloat(trade.q ?? trade.quantity ?? 0);
    const t = {
      price,
      quantity: qty,
      notional: price * qty,
      isBuyerMaker: trade.m ?? trade.isBuyerMaker ?? false,
      side: (trade.m ?? trade.isBuyerMaker) ? 'sell' : 'buy', // m=true → maker buy -> taker sell
      timestamp: trade.T || trade.ts || Date.now(),
      ts: trade.T || trade.ts || Date.now()
    };
    // Faz D: CVD güncelle
    try { this.cvd.update(t); } catch(_){}
    // Divergence tespiti → confluence'a ek sinyal (opsiyonel, düşük skor)
    try {
      const div = this.cvd.detectDivergence?.(20);
      if (div && Math.random() < 0.1) { // spam önleme: %10 ihtimalle
        Logger.info('CVD', `Divergence: ${div} (price ${price} CVD ${this.cvd.getValue().toFixed(0)})`);
      }
    } catch(_){}
    for (const key of this.strategyKeys) {
      try { this.strategies[key]?.processTrade?.(t); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
  }

  _processForceOrder(forceOrder) {
    // Gerçek likidasyon feed'i → LiquidationCascade + spoof çapraz doğrulama
    Logger.info('App', `ForceOrder: ${forceOrder.symbol} ${forceOrder.side} ${(forceOrder.notional/1000).toFixed(1)}k$ @${forceOrder.price}`);
    for (const key of this.strategyKeys) {
      try { this.strategies[key]?.processForceOrder?.(forceOrder); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
    // Spoof + likidasyon aynı bölgede → ekstra confluence (Faz D §2.5)
    // Basit: son spoof zamanı yakınsa ve likidasyon aynı yöndeyse confluence'a ek boost
    try {
      if (this.lastSpoofType && Date.now() - this.lastSpoofTime < 10000) {
        const spoofBearish = this.lastSpoofType === 'bid'; // bid spoof çekildi → gizli satış
        const liquidationSell = forceOrder.side === 'SELL';
        if ((spoofBearish && liquidationSell) || (!spoofBearish && !liquidationSell)) {
          Logger.info('App', 'Spoof+Likidasyon kesişimi → güçlü sinyal (çapraz doğrulama)');
          // Confluence'a manuel boost: son skorları hafif artır (opsiyonel)
        }
      }
    } catch(_){}
  }

  _applyMarkPrice(data) {
    // Mark price → funding/liquidation riski için ileride kullanılabilir
    // Şimdilik sadece log, ileride FundingRateReversal'a beslenecek
    if (data.s && data.p) {
      // Logger.debug('MarkPrice', `${data.s} ${data.p}`);
    }
  }

  // ── Yapay Zeka Hafızası: Kline ile t60 değerlendirmesi (senin Madde 3) ──
  async fetchKlineData(symbol, interval, startTime, endTime, limit = 1) {
    return this.apiQueue.enqueue(async () => {
      try {
        const url = `${CONFIG.exchange.binanceRest}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`Kline HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) return null;
        return { close: parseFloat(data[0][4]), time: data[0][0] };
      } catch (e) {
        Logger.debug('KlineFetch', `fetchKlineData hatası ${symbol} ${interval}:`, e.message);
        return null;
      }
    });
  }

  async evaluatePendingSignals() {
    if (!this.pendingSignals.length && !this.signals.some(s => s.status === 'pending')) return;
    const now = Date.now();
    const profitTarget = this.settings.signalThresholds?.profitTargetPercent ?? 0.2;
    const toEvaluate = [...this.pendingSignals, ...this.signals.filter(s => s.status === 'pending')];

    for (const sig of toEvaluate) {
      try {
        // evaluationPoints yoksa oluştur
        if (!sig.evaluationPoints) sig.evaluationPoints = { t5: null, t15: null, t60: null };
        const elapsed = now - sig.timestamp;

        // 5, 15, 60 dk noktalarında kapanış fiyatını al
        const points = [5, 15, 60];
        for (const mins of points) {
          const key = `t${mins}`;
          if (sig.evaluationPoints[key] !== null) continue; // zaten dolu
          if (elapsed < mins * 60 * 1000) continue; // zamanı gelmedi
          const targetTime = sig.timestamp + mins * 60 * 1000;
          const kline = await this.fetchKlineData(sig.symbol, '1m', targetTime, targetTime + 60000, 1);
          if (kline) sig.evaluationPoints[key] = kline.close;
        }

        // 60dk dolduysa sonuç belirle
        if (elapsed >= 60 * 60 * 1000 && sig.evaluationPoints.t60 !== null && sig.status === 'pending') {
          const entry = sig.price;
          const t60 = sig.evaluationPoints.t60;
          const changePct = ((t60 - entry) / entry) * 100 * (sig.direction === 'buy' ? 1 : -1);
          let result = 'neutral';
          if (changePct >= profitTarget) result = 'success';
          else if (changePct <= -profitTarget) result = 'failure';

          sig.status = result === 'success' ? 'tp' : result === 'failure' ? 'sl' : 'neutral';
          sig.evaluationResult = result;
          sig.evaluationPoints.t60 = t60;

          // Hafızanın Güncellenmesi (Madde 3 - 4. Adım) — detaylı
          const paternKey = sig.paternSignature || sig.reason || sig.contributors?.[0]?.strategy || 'unknown';
          // paternExperiences Map güncelle
          let exp = this.tradingSystemMemory.paternExperiences.get(paternKey);
          if (!exp) {
            exp = { totalPredictions: 0, successCount: 0, failureCount: 0, neutralCount: 0, successRate: 0, averageProfitPercent: 0, averageHoldDuration: 0, maxDrawdown: 0, firstSeen: Date.now(), lastSeen: Date.now() };
          }
          const before = exp.totalPredictions;
          exp.totalPredictions += 1;
          const after = exp.totalPredictions;
          if (result === 'success') exp.successCount += 1;
          else if (result === 'failure') exp.failureCount += 1;
          else exp.neutralCount += 1;
          exp.successRate = exp.totalPredictions > 0 ? (exp.successCount / exp.totalPredictions) * 100 : 0;
          // Ortalama kar yüzdesi
          exp.averageProfitPercent = ((exp.averageProfitPercent * before) + changePct) / after;
          // Ortalama tutma süresi (saniye) — t60 için her zaman 3600, ama genel tutma süresi için hesapla
          const holdDuration = (Date.now() - sig.timestamp) / 1000;
          exp.averageHoldDuration = ((exp.averageHoldDuration * before) + holdDuration) / after;
          // Max drawdown — en kötü kar yüzdesi (en düşük)
          if (before === 0) exp.maxDrawdown = changePct;
          else exp.maxDrawdown = Math.min(exp.maxDrawdown, changePct);
          exp.lastSeen = Date.now();
          if (!exp.firstSeen) exp.firstSeen = sig.timestamp;
          this.tradingSystemMemory.paternExperiences.set(paternKey, exp);

          // reputation.score ve history güncelle (+5 / -10 / -1)
          const repDelta = result === 'success' ? 5 : result === 'failure' ? -10 : -1;
          this.tradingSystemMemory.reputation.score = Math.max(0, Math.min(200, (this.tradingSystemMemory.reputation.score || 100) + repDelta));
          this.tradingSystemMemory.reputation.history.push({ time: Date.now(), score: this.tradingSystemMemory.reputation.score, delta: repDelta, result, patern: paternKey });
          if (this.tradingSystemMemory.reputation.history.length > this.MAX_MEMORY_REPUTATION_HISTORY) {
            this.tradingSystemMemory.reputation.history.splice(0, this.tradingSystemMemory.reputation.history.length - this.MAX_MEMORY_REPUTATION_HISTORY);
          }
          // reputation level güncelle
          const score = this.tradingSystemMemory.reputation.score;
          if (score >= 150) this.tradingSystemMemory.reputation.level = 'Efsane';
          else if (score >= 120) this.tradingSystemMemory.reputation.level = 'Usta';
          else if (score >= 100) this.tradingSystemMemory.reputation.level = 'Acemi Tacir';
          else if (score >= 70) this.tradingSystemMemory.reputation.level = 'Çaylak';
          else this.tradingSystemMemory.reputation.level = 'Acemi';

          // completedSignals arşivi
          this.tradingSystemMemory.completedSignals.push({
            id: sig.id,
            symbol: sig.symbol,
            type: sig.direction,
            paternSignature: paternKey,
            entryPrice: entry,
            exitPrice: t60,
            entryTimestamp: sig.timestamp,
            exitTimestamp: Date.now(),
            profitPercentage: changePct,
            result
          });
          if (this.tradingSystemMemory.completedSignals.length > this.MAX_COMPLETED_SIGNALS) {
            this.tradingSystemMemory.completedSignals.shift();
          }

          // Panteon reputation'ına da yansıt (mevcut sistemle uyumlu, sadece success/failure için)
          // Not: neutral için panteon'a dokunma

          // pending'den çıkar, completed'a ekle
          this.pendingSignals = this.pendingSignals.filter(s => s.id !== sig.id);
          const idx = this.signals.findIndex(s => s.id === sig.id);
          if (idx !== -1) this.signals[idx] = sig;

          this.saveData('utc_signals', this.signals);
          this.saveData('utc_pending_signals', this.pendingSignals);
          this.saveTradingSystemMemory();
          STATE.signals = this.signals;
          STATE.pendingSignals = this.pendingSignals;
          // Arayüzde canlı yansıma (Madde 4)
          try { this.ui.updateReputationCard(); } catch(_){}
          try { this.ui.renderPaternExperiences(); } catch(_){}
          try { this.ui.renderStrategyPerformance(); } catch(_){}

          Logger.info('Eval', `Sinyal ${sig.id.slice(0,8)} t60=${t60} entry=${entry} change=${changePct.toFixed(2)}% → ${result} | rep:${this.tradingSystemMemory.reputation.score} patern:${paternKey} WR:${exp.successRate.toFixed(1)}%`);
        }
      } catch (e) {
        Logger.debug('Eval', `evaluatePendingSignals hatası ${sig.id}:`, e.message);
      }
    }
  }

  // ═════════════════════════════════════════════════════
  // GÖSTERGELER (barva35 calculateAllIndicators)
  // ═════════════════════════════════════════════════════
  calculateAllIndicators() {
    if (this.candles.length < 30) return;
    const closes = this.candles.map((c) => c.close);
    const period = this.settings.params?.rsiPeriod ?? 14;
    const atrPeriod = this.settings.params?.atrPeriod ?? 14;

    this.indicators.rsi = rsi(closes, period);
    this.indicators.atr = atr(this.candles, atrPeriod).at(-1) ?? null;
    this.indicators.sma20 = sma(closes, 20).at(-1) ?? null;
    this.indicators.sma50 = sma(closes, 50).at(-1) ?? null;
    this.indicators.vwap = vwap(this.candles).at(-1) ?? null;
    this.indicators.adx = adx(this.candles, 14).at(-1) ?? null;
    this.indicators.bbands = bollinger(closes, 20);

    // Rejim: ADX > 25 trend, < 20 range, arada transition
    const adxVal = this.indicators.adx;
    this.marketRegime = adxVal === null ? 'unknown' : adxVal > 25 ? 'trend' : adxVal < 20 ? 'range' : 'transition';
    STATE.marketRegime = this.marketRegime;
    STATE.indicators = this.indicators;

    // Sinyal barları confluence skorlarını UI'da göster (render zaten yapar)
  }

  // ═════════════════════════════════════════════════════
  // BAYES AĞIRLIK / EŞİK / GATING
  // ═════════════════════════════════════════════════════
  initDefaultStrategyStats() {
    const base = { alpha: 3, beta: 2, proposals: 0, contrib: 0, wins: 0, losses: 0, shadowWins: 0, shadowLosses: 0, shadowProposals: 0, lastUpdate: Date.now() };
    const stats = {};
    // Fallback: eğer strategyKeys henüz tanımlı değilse (constructor sırası hatası) doğrudan STRATEGY_CLASSES'ten al
    const keys = this.strategyKeys || Object.keys(STRATEGY_CLASSES);
    for (const key of keys) {
      stats[key] = { overall: { ...base }, trend: { ...base }, range: { ...base }, transition: { ...base } };
    }
    return stats;
  }

  applyStrategyParamOverrides() {
    const p = this.settings.strategyParams || {};
    for (const key of Object.keys(this.strategies)) {
      const inst = this.strategies[key];
      if (!inst) continue;
      const ov = p[key] || {};
      for (const k of Object.keys(ov)) {
        if (k in inst) inst[k] = ov[k];
      }
    }
  }

  getStrategyWeight(name) {
    const regime = this.marketRegime || 'overall';
    const regimeStats = this.strategyStats[name]?.[regime];
    const overallStats = this.strategyStats[name]?.overall;

    let s;
    if (regimeStats && (regimeStats.contrib || 0) > 10) s = regimeStats;
    else s = overallStats || { alpha: 3, beta: 2 };

    const mean = s.alpha / (s.alpha + s.beta);
    const totalObs = s.alpha + s.beta;
    const uncertainty = totalObs < 10 ? 0.5 + totalObs / 20 : 1.0;
    let w = (0.5 + mean) * uncertainty;
    w *= this.getGroupBoost(name);
    return Math.max(0.3, Math.min(2.0, w));
  }

  getStrategyGroup(key) {
    if (this.strategyGroups.trending.includes(key)) return 'trending';
    if (this.strategyGroups.meanReversion.includes(key)) return 'meanReversion';
    return 'neutral';
  }

  getGroupBoost(key) {
    const grp = this.getStrategyGroup(key);
    let boost = 1.0;
    if (this.marketRegime === 'trend' && grp === 'trending') boost *= 1.15;
    if (this.marketRegime === 'range' && grp === 'meanReversion') boost *= 1.15;

    const atrPct = this.indicators.atr && this.marketData.price ? this.indicators.atr / this.marketData.price : 0;
    if (atrPct < 0.005) {
      if (grp === 'trending') boost *= 0.9;
      if (grp === 'meanReversion') boost *= 1.05;
    } else if (atrPct > 0.02) {
      if (grp === 'trending') boost *= 1.05;
      if (grp === 'meanReversion') boost *= 0.95;
    }
    // Faz B #3: SessionProfiler -> seans bazlı boost (Asya: meanReversion, NY: trending)
    const session = this.sessionProfiler?.current;
    if (session === 'ASYA') {
      if (grp === 'meanReversion') boost *= 1.08;
      if (grp === 'trending') boost *= 0.96;
    } else if (session === 'NEW YORK') {
      if (grp === 'trending') boost *= 1.08;
      if (grp === 'meanReversion') boost *= 0.97;
    } else if (session === 'LONDRA') {
      if (grp === 'trending') boost *= 1.05;
    }
    return boost;
  }

  /** Eşik: ayar + panteon mod etkisi + runtime offset (barva35 getEffectiveThreshold) */
  getEffectiveThreshold() {
    const base = this.settings.confluenceThreshold ?? 3;
    const moodDelta = this.panteon.getThresholdDelta() * 0.5;
    return base + moodDelta + (this.runtimeThresholdOffset || 0);
  }

  /** Piyasa gating cezası (barva35 marketGatingPenalty) — Faz B entegrasyon: spoof cezası eklendi */
  marketGatingPenalty(direction = null) {
    const g = this.settings.optimization?.gating || { spreadMaxPct: 0.001, minDepthUsd: 50000 };
    const price = this.marketData.price;
    const book = this.orderBook;
    if (!price || !book?.bids?.length || !book?.asks?.length) return 2.0;

    const bestBid = book.bids[0][0];
    const bestAsk = book.asks[0][0];
    const spreadPct = bestAsk > 0 ? (bestAsk - bestBid) / bestAsk : 0;
    const depthUsd = book.bids.slice(0, 10).reduce((s, l) => s + l[0] * l[1], 0) +
                     book.asks.slice(0, 10).reduce((s, l) => s + l[0] * l[1], 0);

    let penalty = 0;
    if (spreadPct > g.spreadMaxPct) penalty += 1.0;
    if (depthUsd < g.minDepthUsd) penalty += 1.0;
    if (Date.now() < this.slippageHighUntil) penalty += 1.0;
    // Faz B #1: Spoof tespiti -> gating cezası (30sn penceresi)
    if (this.lastSpoofTime && Date.now() - this.lastSpoofTime < 30000) {
      penalty += 1.0;
      // Yön bağımlı ceza: bid spoof (sahte alım) -> buy yönünü daha fazla cezalandır, ask spoof -> sell
      if (this.lastSpoofType) {
        if (direction === 'buy' && this.lastSpoofType === 'bid') penalty += 0.5;
        if (direction === 'sell' && this.lastSpoofType === 'ask') penalty += 0.5;
      }
    }
    return penalty;
  }

  // ═════════════════════════════════════════════════════
  // SİNYAL YAŞAM DÖNGÜSÜ
  // ═════════════════════════════════════════════════════
  /** Dinamik TP/SL (barva35 calculateDynamicTpSl) */
  calculateDynamicTpSl(signal) {
    if (!signal?.price) return;
    const levels = this.positionManager.calculateLevels(signal.direction, signal.price, signal.score, this.marketRegime);
    if (!levels) return;
    signal.tp = levels.tp;
    signal.sl = levels.sl;
    signal.entrySlDistance = levels.distance;
    signal.entryTpDistance = Math.abs(levels.tp - signal.price);
  }

  /** Mum onayı bekleyen sinyal ekle (barva35 addPendingSignal) — Yapay Zeka Hafızası t60 için genişletildi */
  addPendingSignal(signal) {
    if (!signal.evaluationPoints) signal.evaluationPoints = { t5: null, t15: null, t60: null };
    if (!signal.paternSignature) signal.paternSignature = signal.contributors?.map(c=>c.strategy).sort().join('+') || 'unknown';
    this.pendingSignals.push(signal);
    // MAX_MEMORY_PENDING_SIGNALS = 100 (en eskiler silinir)
    const MAX_PENDING = 100;
    if (this.pendingSignals.length > MAX_PENDING) this.pendingSignals.splice(0, this.pendingSignals.length - MAX_PENDING);
    this.saveData('utc_pending_signals', this.pendingSignals);
    STATE.pendingSignals = this.pendingSignals;
    this.notify.warning(`⏳ Beklemede: ${signal.direction.toUpperCase()} ${signal.symbol.replace('USDT', '/USDT')} — mum kapanışı onayı bekleniyor (skor ${signal.score.toFixed(1)})`);
  }

  /** Mum kapandığında pending kontrolü (barva35 checkPendingSignals) */
  checkPendingSignals(closedCandle) {
    if (!this.pendingSignals.length) return;
    const remaining = [];
    for (const sig of this.pendingSignals) {
      // Mum sinyal yönünü onaylıyorsa aktifleştir
      const confirms = sig.direction === 'buy'
        ? closedCandle.close > closedCandle.open
        : closedCandle.close < closedCandle.open;
      if (confirms) this.activateSignal(sig);
      else if (Date.now() - sig.timestamp > 300000) {
        // 5 dk doldu, onay gelmedi → iptal
        this.notify.info(`${sig.direction.toUpperCase()} bekleme sinyali iptal (mum onaylamadı)`);
      } else {
        remaining.push(sig);
      }
    }
    this.pendingSignals = remaining;
  }

  /** Sinyali aktifleştir (barva35 activateSignal) — Faz A #12: panteon RR/cooldown zaten Confluence/PositionManager'da */
  activateSignal(signal) {
    signal.status = 'active';
    this.signals.unshift(signal);
    if (this.signals.length > 200) this.signals.pop();
    this.saveData('utc_signals', this.signals);
    STATE.signals = this.signals;
    this.debouncedRender();
    this.chartManager.addSignalMarker(signal);
    this.ui.renderSignals(this.signals);

    let sizeText = signal.recommendedSize ? ` | Boyut: ${signal.recommendedSize}` : '';

    // Efekt + ses — Yapay Zeka Hafızası: patern başarı oranına göre kişiselleştirilmiş açıklama
    this.effects.emit(signal.direction === 'buy' ? 'buy' : 'sell');
    let paternInfo = '';
    try {
      const paternKey = signal.paternSignature || signal.contributors?.map(c=>c.strategy).sort().join('+') || '';
      const exp = this.tradingSystemMemory?.paternExperiences?.get(paternKey);
      if (exp && exp.totalPredictions >= 5) {
        paternInfo = ` | Patern WR:${exp.successRate.toFixed(1)}% (${exp.successCount}/${exp.totalPredictions})`;
        // Başarı oranı yüksekse daha güvenli, düşükse uyarı ekle
        if (exp.successRate >= 70) paternInfo += ' ✅';
        else if (exp.successRate < 45) paternInfo += ' ⚠️';
      } else if (paternKey) {
        paternInfo = ' | Yeni patern — öğreniliyor';
      }
    } catch(_){}
    const message = this.getRandomMessage(signal.direction === 'buy' ? 'buy' : 'sell', {
      Sembol: signal.symbol.replace('USDT', ''),
      Skor: signal.score.toFixed(1)
    });
    // Bildirimde patern bilgisini de göster
    const fullNotify = `AKTİF SİNYAL: ${signal.direction.toUpperCase()} ${signal.symbol.replace('USDT', '/USDT')} | Skor: ${signal.score.toFixed(1)}${sizeText}${paternInfo}`;
    // Zaten yukarıda notify.show yapıldı, ama patern bilgisi eklemek için tekrar göster (veya ilkini değiştir)
    // İlk notify'yi patern bilgisiyle güncelle
    this.notify.show(fullNotify, signal.direction === 'buy' ? 'success' : 'danger');
    this.tts.speak(message + (paternInfo ? ` Patern deneyimi: ${paternInfo}` : ''));

    if (signal.score >= 8 && !this.combatModeActive) this.activateCombatMode();

    // Paper trading: sanal pozisyon aç
    try { this.paperTrading.openPosition(signal); } catch(_){}
    // Slippage ölçümü
    setTimeout(() => this.confluenceEngine.measureSlippage?.(signal.price), 2000);
  }

  /** TP/SL otomatik kapanış kontrolü (barva35 checkAutoCloseSignals) */
  checkAutoCloseSignals() {
    if (!this.marketData.price || !this.signals.length) return;
    const price = this.marketData.price;
    const toRemove = [];

    for (const s of this.signals) {
      if (s.status !== 'active') continue;
      const entry = s.price;
      const risk = Math.abs(entry - s.sl) || 1;

      // MFE (breakeven/trailing için)
      const rNow = s.direction === 'buy'
        ? (price - entry) / risk
        : (entry - price) / risk;
      s.mfeR = Math.max(s.mfeR || 0, rNow);

      const be = this.settings.breakeven ?? { beAtR: 0.8, trailAfterR: 1.5, trailToR: 0.5 };
      const trailOn = this.settings.features?.enableBreakevenTrail;

      let exitPrice = null;
      let outcome = null;

      if (s.direction === 'buy') {
        if (price <= s.sl) { exitPrice = s.sl; outcome = 'sl'; }
        else if (price >= s.tp) { exitPrice = s.tp; outcome = 'tp'; }
        else if (trailOn && s.mfeR >= be.beAtR && !s.beDone) { s.sl = Math.max(s.sl, entry); s.beDone = true; }
        else if (trailOn && s.mfeR >= be.trailAfterR) {
          const newSl = price - (this.indicators.atr || price * 0.0015) * be.trailToR;
          s.sl = Math.max(s.sl, newSl);
        }
      } else {
        if (price >= s.sl) { exitPrice = s.sl; outcome = 'sl'; }
        else if (price <= s.tp) { exitPrice = s.tp; outcome = 'tp'; }
        else if (trailOn && s.mfeR >= be.beAtR && !s.beDone) { s.sl = Math.min(s.sl, entry); s.beDone = true; }
        else if (trailOn && s.mfeR >= be.trailAfterR) {
          const newSl = price + (this.indicators.atr || price * 0.0015) * be.trailToR;
          s.sl = Math.min(s.sl, newSl);
        }
      }

      if (outcome) {
        s.status = outcome;
        s.closePrice = exitPrice;
        toRemove.push(s);
        this.updateSignalResult(s);
      }
    }

    if (toRemove.length) {
      this.signals = this.signals.filter((s) => s.status === 'active' || s.status === 'pending');
      this.saveData('utc_signals', this.signals);
      STATE.signals = this.signals;
      this.ui.renderSignals(this.signals);
    }
  }

  /** Sinyal sonucu: panteon + istatistik + CUSUM (barva35 updateSignalResult) — Faz A #1, #5, Faz B #2 düzeltmeleri */
  updateSignalResult(signal) {
    const isWin = signal.status === 'tp';
    this.stats.total += 1;
    if (isWin) this.stats.tp += 1;
    else this.stats.sl += 1;
    this.saveData('utc_stats', this.stats);
    // Faz A #1: Kill switch için STATE.stats senkronizasyonu
    STATE.stats = { ...this.stats };
    STATE.signals = this.signals;

    // Panteon itibarı
    const contributing = signal.contributors?.[0]?.strategy || signal.reason?.split(',')[0]?.trim();
    this.panteon.updateReputation({ strategy: contributing, outcome: signal.status });

    // Bayes istatistikleri (katkıda bulunan her strateji) — Faz A #5: contrib artık gerçekten artıyor
    for (const c of signal.contributors || []) {
      const s = this.strategyStats[c.strategy];
      if (!s) continue;
      const regimeKey = this.marketRegime && s[this.marketRegime] ? this.marketRegime : 'overall';
      const target = s[regimeKey] || s.overall;
      const overall = s.overall;
      if (target) {
        if (isWin) target.alpha += 1;
        else target.beta += 1;
        target.wins = (target.wins || 0) + (isWin ? 1 : 0);
        target.losses = (target.losses || 0) + (isWin ? 0 : 1);
        target.contrib = (target.contrib || 0) + 1;
        target.lastUpdate = Date.now();
        // Faz A #5: overall contrib her zaman artar (rejim özel contrib + overall)
        if (target !== overall) {
          overall.contrib = (overall.contrib || 0) + 1;
          overall.lastUpdate = Date.now();
          // overall alfa/beta da rejimden bağımsız genel öğrenme için güncellenir mi? Hayır, sadece contrib için - Bayes güncellemesi rejim bazlı kalır
        }
        // Shadow istatistikleri de güncelle (gölge -> canlı geçişi için)
        if (this.strategies[c.strategy]?._isLive === false) {
          if (isWin) target.shadowWins = (target.shadowWins || 0) + 1;
          else target.shadowLosses = (target.shadowLosses || 0) + 1;
        }
      }
    }
    this.saveStrategyStats();
    STATE.strategyStats = this.strategyStats;
    // Patch #2: Gölge istatistikleri ve rehab
    try { this.updateStrategyShadowStats(signal); } catch(e) { Logger.error('ShadowStats', e); }
    try { this.evaluateShadowRehab(); } catch(e) { Logger.error('ShadowRehab', e); }
    // Faz C: Strateji performans panelini canlı yenile (modal açıksa)
    try {
      const overlay = document.getElementById('settings-modal-overlay');
      if (overlay?.classList.contains('visible')) this.ui.renderStrategyPerformance();
    } catch(_){}

    // CUSUM — Faz B #2: kötü drift -> otomatik aksiyon
    if (this.settings.features.enableCUSUMDrift && this.cusumDetector.update(isWin)) {
      this.notify.warning('CUSUM: kötü drift tespit — strateji performansı bozuluyor, eşik sıkılaştırılıyor');
      // Faz B: CUSUM drift = eşik otomatik sıkılaştır + oto shadow-ban tetikle
      this.runtimeThresholdOffset = Math.min(1.5, (this.runtimeThresholdOffset || 0) + 0.15);
      this.autoToggleStrategies();
      Logger.warn('CUSUM', `Drift sonrası threshold offset: ${this.runtimeThresholdOffset.toFixed(2)}`);
    }

    // Efekt + bildirim
    if (isWin) {
      this.effects.emit('tp');
      this.notify.success(`🎉 KÂR: ${signal.direction.toUpperCase()} ${signal.symbol.replace('USDT', '/USDT')} — TP ${formatPrice(signal.tp, this.symbolInfo?.tickSize)}`);
      this.tts.speak('Kâr alındı. Tebrikler.');
    } else {
      this.effects.emit('sl');
      this.notify.danger(`💥 STOP: ${signal.direction.toUpperCase()} ${signal.symbol.replace('USDT', '/USDT')} — SL ${formatPrice(signal.sl, this.symbolInfo?.tickSize)}`);
      this.tts.speak('Stop çalıştı. Pozisyon kapandı.');
    }

    // Kill switch kontrolü
    this.riskGuardian.checkKillSwitch();
  }

  /** Önerilen pozisyon boyutu (barva35 getRecommendedPositionSize) */
  getRecommendedPositionSize(score) {
    if (!this.settings.features.enableDynamicSizing) return null;
    if (score >= 7.5) return '2.0x Yüksek';
    if (score >= 6.0) return '1.5x Orta-Yüksek';
    if (score >= 4.5) return '1.0x Standart';
    return '0.5x Düşük';
  }

  // ═════════════════════════════════════════════════════
  // GÖLGE / OTO-OPTİMİZASYON
  // ═════════════════════════════════════════════════════
  recordShadowProposal(strategy, direction, reason, score) {
    pushCap(this.shadowProposals, { strategy, direction, reason, score, ts: Date.now() }, 4000);
    const s = this.strategyStats[strategy]?.overall;
    if (s) {
      s.shadowProposals = (s.shadowProposals || 0) + 1;
      this.saveStrategyStats();
    }
  }

  updateStrategyShadowStats(signal) {
    const windowMs = (this.settings.cooldowns?.proposalTimeoutMs || 3000) * 2;
    const start = signal.timestamp - windowMs;
    const end = signal.timestamp;
    const creditBase = 0.5;
    const byStrat = {};
    for (const p of this.shadowProposals) {
      if (p.timestamp >= start && p.timestamp <= end && p.direction === signal.direction) {
        byStrat[p.strategy] = p;
      }
    }
    for (const strat of Object.keys(byStrat)) {
      let st = this.strategyStats[strat];
      if (!st) {
        st = this.initDefaultStrategyStats()[strat];
        if (!st) continue;
        this.strategyStats[strat] = st;
      }
      // overall ve rejim ayrı ayrı güncelle
      const targets = [st.overall, st[this.marketRegime]].filter(Boolean);
      for (const target of targets) {
        target.shadowProposals = (target.shadowProposals || 0) + 1;
        if (signal.status === 'tp') {
          target.shadowWins = (target.shadowWins || 0) + 1;
          target.alpha = (target.alpha || 3) + creditBase;
        } else if (signal.status === 'sl') {
          target.shadowLosses = (target.shadowLosses || 0) + 1;
          target.beta = (target.beta || 2) + creditBase;
        }
        target.lastUpdate = Date.now();
      }
    }
    const keepAfter = Date.now() - 10 * 60 * 1000;
    this.shadowProposals = this.shadowProposals.filter(p => p.timestamp >= keepAfter);
    this.saveStrategyStats();
  }

  evaluateShadowRehab() {
    const pen = this.settings.penalties || {};
    if (!pen.shadowEnabled) return;
    for (const key of Object.keys(this.strategies)) {
      if (!this.settings.statusMaps.shadowBanned[key]) continue;
      if (this.settings.statusMaps.hardBanned[key]) continue;
      const st = this.strategyStats[key]?.overall || {};
      const sw = st.shadowWins || 0, sl = st.shadowLosses || 0, sp = st.shadowProposals || 0;
      const total = sw + sl;
      const winRate = total > 0 ? sw / total : 0;
      if (sp >= (pen.minShadowProposals || 20) && winRate >= (pen.rehabWinRate || 0.58)) {
        this.settings.activeStrategies[key] = true;
        this.settings.statusMaps.shadowBanned[key] = false;
        this.updateActiveStrategies();
        this.saveSettings();
        this.showNotification(`Rehabilite: ${this.strategies[key].displayName} tekrar canlı! (gölge WR=${(winRate*100).toFixed(0)}%)`, 'success');
        if (this.settings.features.enableTTS) this.speak(this.getRandomMessage('shadowRehab', { 'Strateji': this.strategies[key].displayName }));
      }
    }
  }

  autoToggleStrategies() {
    const opt = this.settings.optimization || {};
    const pen = this.settings.penalties || {};
    // Shadowban kapalıysa ve autoToggle kapalıysa çık
    if (!opt.autoToggle && !pen.shadowEnabled) return;
    const nowMs = Date.now();

    for (const key of this.strategyKeys) {
      const inst = this.strategies[key];
      const stats = this.strategyStats[key]?.overall;
      if (!inst || !stats) continue;
      const w = this.getStrategyWeight(key);

      // Shadow ban: zayıf + yeterli katkı (penalties öncelikli, fallback optimization)
      const minWeight = pen.minWeightToShadow ?? opt.minWeightToStay ?? 0.60;
      const minContrib = pen.minContribForShadow ?? opt.minContribForToggle ?? 30;
      if (w < minWeight && (stats.contrib || 0) >= minContrib && inst._isLive) {
        inst.setIsLive(false);
        this.settings.activeStrategies[key] = false;
        this.settings.statusMaps.shadowBanned[key] = true;
        stats.lastShadowToggle = nowMs;
        this.saveSettings();
        this.updateActiveStrategies();
        this.notify.warning(`Oto-optimizasyon: ${inst.displayName} gölgeye alındı (w=${w.toFixed(2)})`);
        if (this.settings.features.enableTTS) this.speak(this.getRandomMessage('shadowBan', { 'Strateji': inst.displayName }));
      }
      // Rehabilitasyon: gölgede iyi performans (sadece shadowBanned, hardBanned değil)
      if (!inst._isLive && this.settings.statusMaps.shadowBanned[key] && !this.settings.statusMaps.hardBanned[key]) {
        const sr = stats.shadowProposals >= 20 ? stats.shadowWins / stats.shadowProposals : 0;
        const minShadowProposals = pen.minShadowProposals || 20;
        const rehabWR = pen.rehabWinRate || 0.58;
        const coolOff = pen.coolOffMs || 30*60*1000;
        // Eski evaluateShadowRehab ile aynı mantık ama burda da kontrol (çift koruma)
        if (stats.shadowProposals >= minShadowProposals && sr >= rehabWR && nowMs - (stats.lastShadowToggle || 0) > coolOff) {
          inst.setIsLive(true);
          this.settings.activeStrategies[key] = true;
          this.settings.statusMaps.shadowBanned[key] = false;
          this.saveSettings();
          this.updateActiveStrategies();
          this.notify.success(`Rehabilite: ${inst.displayName} tekrar canlı! (gölge WR=${(sr * 100).toFixed(0)}%)`);
          if (this.settings.features.enableTTS) this.speak(this.getRandomMessage('shadowRehab', { 'Strateji': inst.displayName }));
        }
      }
    }
  }

  // ═════════════════════════════════════════════════════
  // PERİYODİK / RENDER / SİNYAL BARLARI
  // ═════════════════════════════════════════════════════
  runPeriodicAnalysis() {
    if (!this.isRunning) return;
    for (const key of this.strategyKeys) {
      try { this.strategies[key]?.periodicAnalyze?.(); }
      catch (e) { Logger.error(`Strategy:${key}`, e); }
    }
    this.autoToggleStrategies();
    this.panteon.checkInactivity();
    // Faz A #10: SpoofDetector oto-optimizasyon artık periyodik çağrılıyor
    if (this.settings.features.enableSpoofDetection) {
      try { this.spoofDetector.autoOptimizeThreshold(); } catch(_) {}
    }
    // Faz C: MTF özet güncelle + otomatik kehanet
    try {
      this.ui.updateMtfDisplay();
      this.checkMtfAutoProphecy();
    } catch(_){}
    // Faz C: Strateji performansını periyodik yenile (modal açıksa)
    try {
      const overlay = document.getElementById('settings-modal-overlay');
      if (overlay?.classList.contains('visible')) {
        this.ui.renderStrategyPerformance();
        this.ui.updateReputationCard();
        this.ui.renderPaternExperiences();
        this.ui.updatePaperTrading();
      }
    } catch(_){}
    // BÖLÜM 3: Metrik kartları + sparkline + top-bids/asks güncelle
    try { this.updateMetricsDisplay(); } catch(_){}
  }

  render() {
    this.ui.updateTicker();
    this.ui.updatePriceDisplay();
    this.ui.updateSignalBars(this.confluenceEngine.buyScore || 0, this.confluenceEngine.sellScore || 0);
    // BÖLÜM 3: Metrik kartları her render'da güncelle (500ms)
    try { this.updateMetricsDisplay(); } catch(_){}
    // Faz C: MTF özetini kehanet paneline ekle
    let mtfText = '—';
    try {
      const tfList = ['5m','15m','1h','4h'];
      const icons = { up: '↑', down: '↓', neutral: '→', unknown: '?' };
      mtfText = tfList.map(tf => {
        const t = this.multiTimeframeManager?.getTrend(tf) || 'unknown';
        return `${tf}:${icons[t]||'?'}`;
      }).join(' ');
    } catch(_){}
    this.ui.updateKehanet({
      session: `${this.sessionProfiler.getIcon()} ${this.sessionProfiler.current}`,
      regime: this.marketRegime,
      pulse: this.indicators.atr ? `ATR ${formatPrice(this.indicators.atr)}` : '—',
      guardian: this.riskGuardian.killSwitchActivated ? '🚨 DURDURULDU' : 'Aktif',
      mtf: mtfText
    });
    // Throttle MTF detay panelini de güncelle (ayrı element)
    try { this.ui.updateMtfDisplay(); } catch(_){}
  }

  updateSession() {
    this.sessionProfiler.detect();
  }

  // Faz C: MTF 4/4 aynı yön → otomatik kehanet (throttle 5dk)
  checkMtfAutoProphecy() {
    if (!this.multiTimeframeManager?.data) return;
    const tfList = ['5m','15m','1h','4h'];
    const trends = tfList.map(tf => this.multiTimeframeManager.getTrend(tf));
    if (trends.some(t => t === 'unknown' || t === 'neutral')) return; // hepsi net değilse bekle
    const allUp = trends.every(t => t === 'up');
    const allDown = trends.every(t => t === 'down');
    const now = Date.now();
    if (this._lastAutoProphecy && now - this._lastAutoProphecy < 300000) return; // 5dk throttle
    if (allUp || allDown) {
      const prop = 'AGGRESSIVE'; // her iki yönde de güçlü teyit → saldırgan (4/4 up veya 4/4 down)
      // Eğer 4/4 çelişkili olsaydı DEFENSIVE olacaktı, ama hepsi aynı yönde zaten teyit
      // Çelişkili durum için ayrı kontrol: 2 up 2 down
      // Burada sadece teyit durumu
      this.panteon.applyProphecy(prop);
      this._lastAutoProphecy = now;
      Logger.info('MTF', `4/4 ${allUp?'UP':'DOWN'} teyit → otomatik kehanet ${prop}`);
      // Düşük frekanslı bildirim (spam olmasın)
      this.notify.info(`📊 MTF 4/4 ${allUp?'YUKARI':'AŞAĞI'} teyit → Kehanet: ${prop==='AGGRESSIVE'?'⚔️ Saldırgan':'🛡️ Savunmacı'}`);
    } else {
      // Çelişkili: 2 up 2 down gibi tam bölünme → DEFENSIVE
      const upCount = trends.filter(t=>t==='up').length;
      const downCount = trends.filter(t=>t==='down').length;
      if (upCount===2 && downCount===2) {
        if (this._lastAutoProphecy && now - this._lastAutoProphecy < 300000) return;
        this.panteon.applyProphecy('DEFENSIVE');
        this._lastAutoProphecy = now;
        Logger.info('MTF', '2/2 çelişki → otomatik kehanet DEFENSIVE');
        this.notify.info('📊 MTF çelişkili (2↗ 2↘) → Kehanet: 🛡️ Savunmacı');
      }
    }
  }

  updateCandleCountdown() {
    if (!this.candles.length) return;
    const last = this.candles[this.candles.length - 1];
    const tfMs = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000 }[this.currentTimeframe] || 900000;
    const remain = Math.max(0, Math.floor((last.time + tfMs - Date.now()) / 1000));
    this.ui.updateCandleCountdown(remain);
  }

  async fetchSymbolInfo(symbol) {
    try {
      // Binance exchangeInfo'dan sembol detaylarını al (tickSize hassasiyeti için)
      const url = `https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`exchangeInfo ${res.status}`);
      const data = await res.json();
      const s = data.symbols?.[0];
      if (!s) throw new Error('sembol bulunamadı');
      const priceFilter = s.filters.find(f => f.filterType === 'PRICE_FILTER');
      const lot = s.filters.find(f => f.filterType === 'LOT_SIZE');
      const tickSize = priceFilter ? parseFloat(priceFilter.tickSize) : 0.01;
      const stepSize = lot ? parseFloat(lot.stepSize) : 0.001;
      const pricePrecision = priceFilter ? (priceFilter.tickSize.includes('.') ? priceFilter.tickSize.split('.')[1].replace(/0+$/, '').length : 0) : 2;
      const quantityPrecision = lot ? (lot.stepSize.includes('.') ? lot.stepSize.split('.')[1].replace(/0+$/, '').length : 0) : 6;
      this.symbolInfo = {
        pricePrecision: pricePrecision || 2,
        quantityPrecision: quantityPrecision || 6,
        tickSize,
        stepSize,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        symbol: s.symbol,
        status: s.status
      };
      // STATE'e de yaz (formatPrice ve diğerleri için)
      if (typeof STATE !== 'undefined') STATE.symbolInfo = this.symbolInfo;
      Logger.info('SymbolInfo', `${symbol} tickSize=${tickSize} prec=${pricePrecision} stepSize=${stepSize}`);
      if (s.status !== 'TRADING') {
        this.notify?.warning(`Sembol ${symbol} durumu: ${s.status}`);
      }
      return this.symbolInfo;
    } catch (e) {
      Logger.warn('SymbolInfo', `fetchSymbolInfo hatası ${symbol}:`, e.message);
      // Fallback: eski sembolden devam et
      return this.symbolInfo;
    }
  }

  updateMetricsDisplay() {
    // Alıcı/Satıcı Oranı: son 5s trade'lerden (OrderFlowMomentum mantığı)
    let ratio = null;
    try {
      const trades = this.cvd?.history?.slice(-50) || [];
      if (trades.length > 10) {
        let buy = 0, sell = 0;
        for (const t of trades.slice(-20)) {
          if (t.delta > 0) buy += t.delta;
          else sell += Math.abs(t.delta);
        }
        const total = buy + sell;
        if (total > 0) ratio = buy / total;
      }
    } catch(_){}
    // Hacim Patlaması: isVolumeSpike ile
    let volSpike = null;
    try {
      const lastVol = this.candles[this.candles.length-1]?.volume;
      if (lastVol) {
        const vols = this.candles.map(c=>c.volume);
        const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
        const avg5 = avg(vols.slice(-5));
        if (avg5 > 0) volSpike = lastVol / avg5;
      }
    } catch(_){}
    // Top 3 bids/asks (hacme göre sıralı)
    let topBids = null, topAsks = null;
    try {
      if (this.orderBook?.bids?.length) {
        topBids = [...this.orderBook.bids].sort((a,b)=>b[1]-a[1]).slice(0,3);
      }
      if (this.orderBook?.asks?.length) {
        topAsks = [...this.orderBook.asks].sort((a,b)=>b[1]-a[1]).slice(0,3);
      }
    } catch(_){}
    try { this.ui.updateMetrics(ratio, volSpike, topBids, topAsks); } catch(_){}
  }

  startPerformanceMonitor() {
    this.performanceInterval = setInterval(() => {
      if (this.settings.features?.enableAutoOptimize) {
        // Oto-tune: strateji parametre eşik ayarı (basit)
        for (const key of this.strategyKeys) {
          const stats = this.strategyStats[key]?.overall;
          if (!stats || stats.proposals < 20) continue;
          const wr = stats.wins / (stats.wins + stats.losses || 1);
          // Düşük performanslı stratejilerin eşiklerini sıkılaştır
        }
      }
    }, 60000);
  }

  updateDynamicThresholds() {
    // BÖLÜM 2: Dinamik ve öğrenen sinyal eşikleri (reputation + patern başarı oranına göre)
    const rep = this.tradingSystemMemory?.reputation?.score || 100;
    const baseProfit = 0.2;
    const baseVolumeSpike = 5;
    // Reputation yüksekse daha sıkı (daha az sinyal, daha güvenli), düşükse daha gevşek
    let profitTarget = baseProfit;
    let volumeSpike = baseVolumeSpike;
    if (rep >= 130) { profitTarget = 0.25; volumeSpike = 6; }
    else if (rep >= 110) { profitTarget = 0.22; volumeSpike = 5.5; }
    else if (rep <= 80) { profitTarget = 0.15; volumeSpike = 4; }
    else if (rep <= 90) { profitTarget = 0.18; volumeSpike = 4.5; }

    // Patern bazlı: eğer son 10 sinyalde en sık görülen paternin WR yüksekse, eşikleri sıkılaştır
    try {
      const exps = Array.from(this.tradingSystemMemory.paternExperiences.values());
      if (exps.length) {
        const best = exps.reduce((a,b) => a.successRate > b.successRate ? a : b);
        if (best.successRate >= 70 && best.totalPredictions >= 10) {
          profitTarget *= 1.1;
          volumeSpike *= 1.1;
        } else if (best.successRate < 45 && best.totalPredictions >= 10) {
          profitTarget *= 0.9;
          volumeSpike *= 0.9;
        }
      }
    } catch(_){}

    this.settings.signalThresholds.profitTargetPercent = parseFloat(profitTarget.toFixed(3));
    this.settings.signalThresholds.volumeSpikeThreshold = parseFloat(volumeSpike.toFixed(1));
    // strongBuyRatio da dinamik olsun
    const baseRatio = 0.55;
    this.settings.signalThresholds.strongBuyRatio = rep >= 120 ? 0.60 : rep <= 80 ? 0.50 : baseRatio;
  }

  // Gelişmiş hacim patlaması analizi (P4_BUY/SELL için)
  isVolumeSpike(currentVolume) {
    if (!currentVolume || !this.candles || this.candles.length < 30) return false;
    const vols = this.candles.map(c => c.volume);
    const avg = (arr) => arr.reduce((a,b)=>a+b,0)/arr.length;
    const avg5 = avg(vols.slice(-5));
    const avg15 = avg(vols.slice(-15));
    const avg30 = avg(vols.slice(-30));
    const threshold = this.settings.signalThresholds.volumeSpikeThreshold || 5;
    // Son 1dk hacmi, 5/15/30dk ortalamasının threshold katı mı?
    return currentVolume > avg5 * threshold * 0.5 || currentVolume > avg15 * threshold * 0.3 || currentVolume > avg30 * threshold * 0.2;
  }

  autoTuneStrategyParams() {
    if (!this.settings.optimization.enabled) return;
    const step = 0.1;
    const meta = {
      wallBounce: { DISTANCE_THRESHOLD_PERCENT: {min:0.0001,max:0.001, strict:'up'} },
      velocityScalping: { VELOCITY_THRESHOLD_PERCENT:{min:0.0005,max:0.003, strict:'up'} },
      liquidityGaps: { GAP_THRESHOLD_PERCENT:{min:0.0003,max:0.003, strict:'up'} },
      breakoutPattern: { BREAK_PCT:{min:0.0001,max:0.001, strict:'up'}, VOL_SPIKE:{min:1.0,max:3.0, strict:'up'} },
      supportResistance: { THRESH:{min:0.0005,max:0.005, strict:'down'} },
      fibonacciRetracement: { TOL:{min:0.0005,max:0.005, strict:'down'} },
      vwapReversion: { MULT:{min:0.6,max:2.0, strict:'up'} },
      superTrend: { MULT:{min:1.0,max:6.0, strict:'up'} },
      marketStructure: { SWING:{min:2,max:7, strict:'up'} },
      institutionalOrderFlow: { IMB_THRESHOLD:{min:1.2,max:4.0, strict:'up'} },
      microSpreadArbitrage: { SPREAD_PCT:{min:0.0003,max:0.003, strict:'up'} },
      volumeProfile: { PERIOD: {min:20,max:30, strict:'up'}, SPIKE:{min:1.2,max:3.0, strict:'up'}, CLOSE_POS:{min:0.5,max:0.9, strict:'up'} },
      divergenceDetection: { SWING_PERIOD:{min:2,max:5, strict:'up'} }
    };
    const p = this.settings.strategyParams;
    let changed = false;
    for (const key of Object.keys(this.strategies)) {
      const w = this.getStrategyWeight(key);
      const defs = meta[key]; if (!defs) continue;
      const cur = p[key] || {}; let localChanged = false;
      const direction = (w < 0.7) ? 'moreStrict' : (w > 1.3 ? 'lessStrict' : 'keep');
      if (direction === 'keep') continue;
      for (const par of Object.keys(defs)) {
        const conf = defs[par]; const val = cur[par] ?? this.strategies[key][par];
        if (val == null) continue;
        let newVal = val;
        if (direction === 'moreStrict') {
          if (conf.strict === 'up') newVal = val * (1 + step);
          else if (conf.strict === 'down') newVal = val * (1 - step);
        } else if (direction === 'lessStrict') {
          if (conf.strict === 'up') newVal = val * (1 - step);
          else if (conf.strict === 'down') newVal = val * (1 + step);
        }
        newVal = Math.max(conf.min, Math.min(conf.max, newVal));
        if (Math.abs(newVal - val) / Math.max(1e-8, val) > 0.02) {
          cur[par] = (typeof val === 'number' && Number.isInteger(val)) ? Math.round(newVal) : parseFloat(newVal.toFixed(6));
          localChanged = true;
        }
      }
      if (localChanged) { p[key] = cur; changed = true; }
    }
    if (changed) {
      this.saveSettings();
      this.applyStrategyParamOverrides();
      this.showNotification('Strateji parametreleri mikro-optimize edildi (ameliyat).', 'warning');
    }
  }

  // ═════════════════════════════════════════════════════
  // KOMBAT MODU & GÖRSEL
  // ═════════════════════════════════════════════════════
  activateCombatMode() {
    this.combatModeActive = true;
    document.body.classList.add('combat-mode');
    this.notify.warning('⚔️ KOMBAT MODU! Skor ≥ 8 — dikkat!');
  }

  showFirstLight() {
    // Başlangıç flaşı
    this.effects.emit('divine');
  }

  // ═════════════════════════════════════════════════════
  // BİLDİRİM / SES / MESAJLAR
  // ═════════════════════════════════════════════════════
  showNotification(message, type = 'info') {
    this.notify.show(message, type);
  }

  speak(text) {
    this.tts.speak(text);
  }

  getRandomMessage(type, vars = {}) {
    const messages = {
      buy: ['Olimpos\'un rüzgarı arkana esecek...', 'Metatron fısıldıyor: alım gücü artıyor...', 'Uriel mızrağını kaldırdı!'],
      sell: ['Kılıçlar kınına dönüyor...', 'Raphael uyardı: satış baskısı büyüyor...', 'O vakit geldi...'],
      shadowBan: ['[Strateji] gölgeye alındı. Uslan da gel!', 'Şşşt [Strateji], gölge moduna geç. Önce pistte kendini ispat et.'],
      shadowRehab: ['Bravo! [Strateji] gölgede form tuttu, tekrar sahnede.', '[Strateji] rehabilite edildi. Hadi bakalım, yüzümüzü kara çıkarma!'],
      rogueOfDay: ['Bugünün şerefsizi: [Strateji]! Kendine gel de adam gibi sinyal ver.', '[Strateji], bugün gözüm üzerinde. Şerefsizlikte ısrar etme!']
    };
    const list = messages[type] || ['İşlem zamanı.'];
    let msg = list[Math.floor(Math.random() * list.length)];
    for (const [k, v] of Object.entries(vars)) msg = msg.replace(`{${k}}`, String(v));
    return msg;
  }

  exportLogs() {
    const logs = Logger.getJournal().map((l) => `[${new Date(l.ts).toISOString()}] [${l.tag}] ${l.msg}`).join('\n');
    const blob = new Blob([logs], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'komuta-merkezi-log.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ═════════════════════════════════════════════════════
  // AYARLAR / KALICILIK / SEMBOL / TEMA
  // ═════════════════════════════════════════════════════
  loadData(key) { return this.storage.getJsonSync(key); }
  saveData(key, val) { this.storage.setJson(key, val); }

  saveSettings() {
    this.saveData('utc_settings', this.settings);
  }

  _loadSettings() {
    // Faz A #7: Tek kaynak StorageBridge — constructor'da storage ready değilse DEFAULT döner, gerçek yükleme init() içinde yapılır
    // Geriye dönük uyum için localStorage fallback sadece storage ready değilken ve init öncesi acil durum için
    try {
      if (this.storage?.ready) {
        const fromStorage = this.storage.getJsonSync('utc_settings');
        if (fromStorage) return { ...safeClone(DEFAULT_SETTINGS), ...fromStorage };
      }
      // Fallback: sadece ilk açılışta migration öncesi eski localStorage verisi varsa (Migration zaten taşıdıysa bu dal çalışmaz)
      const raw = localStorage.getItem('utc_settings');
      if (raw) return { ...safeClone(DEFAULT_SETTINGS), ...JSON.parse(raw) };
    } catch (_) {}
    return safeClone(DEFAULT_SETTINGS);
  }

  saveStrategyStats() {
    this.saveData('utc_strategy_stats', this.strategyStats);
  }

  savePanteonState() {
    this.saveData('pantheon_state', this.panteon.serialize());
  }

  saveTradingSystemMemory() {
    try {
      const toSave = {
        paternExperiences: Array.from(this.tradingSystemMemory.paternExperiences.entries()),
        reputation: this.tradingSystemMemory.reputation,
        completedSignals: this.tradingSystemMemory.completedSignals
      };
      this.saveData('utc_trading_memory', toSave);
      // Ayrıca reputation.history ve paternExperiences için limit kontrolü zaten yapıldı
    } catch(e) { Logger.debug('Memory', 'saveTradingSystemMemory hatası', e.message); }
  }

  loadTradingSystemMemory() {
    try {
      const loaded = this.storage.getJsonSync('utc_trading_memory');
      if (loaded) {
        if (loaded.paternExperiences) {
          this.tradingSystemMemory.paternExperiences = new Map(loaded.paternExperiences);
        }
        if (loaded.reputation) this.tradingSystemMemory.reputation = loaded.reputation;
        if (loaded.completedSignals) this.tradingSystemMemory.completedSignals = loaded.completedSignals;
      }
    } catch(e) { Logger.debug('Memory', 'loadTradingSystemMemory hatası', e.message); }
  }

  updatePanteonUI() {
    this.ui.updatePanteon(this.panteon.getElciler());
  }

  applyProphecy(prophecy) {
    this.panteon.applyProphecy(prophecy);
    this.notify.info(`Kehanet: ${prophecy === 'DEFENSIVE' ? '🛡️ Savunmacı' : prophecy === 'AGGRESSIVE' ? '⚔️ Saldırgan' : '⚖️ Dengeli'} mod aktif`);
  }

  async changeSymbol(raw) {
    const s = (raw || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{2,12}$/.test(s) || !s.endsWith('USDT')) {
      this.notify.warning('Geçersiz sembol (örn: BTCUSDT)');
      return;
    }
    await this.fetchSymbolInfo(s);
    this.currentSymbol = s;
    this.saveData('utc_current_symbol', s);
    this.candles = [];
    this.chartManager?.setData([]);
    if (this.isRunning) {
      this.exchange.connect(s, this.currentTimeframe);
      this.multiTimeframeManager.initialize(s);
      this.exchange.fetchInitialData(s, this.currentTimeframe).then((candles) => {
        if (candles.length) { this.candles = candles; this.chartManager.setData(candles); this.calculateAllIndicators(); }
      });
    }
    this.notify.info(`Sembol: ${s}`);
  }

  changeTimeframe(tf) {
    this.currentTimeframe = tf;
    this.saveData('utc_current_timeframe', tf);
    if (this.isRunning) {
      this.exchange.connect(this.currentSymbol, tf);
      this.exchange.fetchInitialData(this.currentSymbol, tf).then((candles) => {
        if (candles.length) { this.candles = candles; this.chartManager.setData(candles); this.calculateAllIndicators(); }
      });
    }
  }

  changeExchange(exchangeName) {
    const name = (exchangeName || '').toLowerCase().trim();
    if (!['binance','bybit','okx'].includes(name)) {
      this.notify?.warning(`Geçersiz borsa: ${exchangeName}`);
      return;
    }
    this.currentExchange = name;
    this.saveData('utc_current_exchange', name);
    STATE.exchange = name;
    // Yeni stream sınıfı ile exchange'i yeniden oluştur
    const wasRunning = this.isRunning;
    if (wasRunning) this.stop();
    try {
      const StreamClass = EXCHANGE_STREAMS[name] || BinanceStream;
      this.exchange = new ExchangeManager(this, StreamClass, name);
      this.notify?.info(`Borsa değiştirildi: ${name.toUpperCase()}`);
      Logger.info('App', `Borsa: ${name}`);
    } catch(e) {
      Logger.error('App', 'changeExchange hatası', e);
      this.notify?.warning('Borsa değiştirme hatası');
    }
    // UI'daki select'i güncelle
    const sel = document.getElementById('exchange-select');
    if (sel) sel.value = name;
    if (wasRunning) this.start();
  }

  toggleTheme() {
    const order = ['dark', 'light', 'war'];
    const next = order[(order.indexOf(CONFIG.theme) + 1) % order.length];
    CONFIG.theme = next;
    document.documentElement.setAttribute('data-theme', next);
    this.chartManager?.updateTheme();
    this.saveData('utc_theme', next);
    this.notify.info(`Tema: ${next}`);
  }

  setTheme(theme) {
    CONFIG.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.chartManager?.updateTheme();
    this.saveData('utc_theme', theme);
  }

  // ── Modal işlemleri ──────────────────────────────────
  openSettingsModal() {
    document.getElementById('settings-modal-overlay').classList.add('visible');
    this._populateModal();
    // Faz C: Modal açılınca performans tablosunu doldur
    try { this.ui.renderStrategyPerformance(); } catch(_){}
    try { this.ui.updateReputationCard(); } catch(_){}
    try { this.ui.renderPaternExperiences(); } catch(_){}
    try { this.ui.updatePaperTrading(); } catch(_){}
    try { this.ui.renderSignals(this.signals); } catch(_){}
  }

  closeSettingsModal() {
    document.getElementById('settings-modal-overlay').classList.remove('visible');
  }

  _populateModal() {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    set('modal-confluence-threshold', this.settings.confluenceThreshold);
    set('modal-param-rsi-period', this.settings.params.rsiPeriod);
    set('modal-param-atr-period', this.settings.params.atrPeriod);
    set('modal-param-wall-btc', this.settings.params.wallBtc);
    set('modal-param-rr-ratio', this.settings.params.rrRatio);
    set('modal-signal-cooldown-ms', this.settings.cooldowns.signalMs);
    set('modal-same-direction-cooldown-ms', this.settings.cooldowns.sameDirectionMs);
    set('modal-opposite-direction-cooldown-ms', this.settings.cooldowns.oppositeDirectionMs);
    set('modal-reverse-hysteresis-points', this.settings.cooldowns.reverseHysteresisPoints);
    set('modal-proposal-timeout-ms', this.settings.cooldowns.proposalTimeoutMs);
    set('modal-strategy-proposal-cooldown-ms', this.settings.cooldowns.strategyProposalMs);
    set('modal-be-at-r', this.settings.breakeven.beAtR);
    set('modal-trail-after-r', this.settings.breakeven.trailAfterR);
    set('modal-trail-to-r', this.settings.breakeven.trailToR);
    set('modal-mtf-timeframe', this.settings.features.mtfTimeframe);
    this._setCheckbox('modal-enable-spoof-detection', this.settings.features.enableSpoofDetection);
    this._setCheckbox('modal-enable-cusum-drift', this.settings.features.enableCUSUMDrift);
    this._setCheckbox('modal-enable-risk-guardian', this.settings.features.enableRiskGuardian);
    this._setCheckbox('modal-enable-auto-optimize', this.settings.features.enableAutoOptimize);
    this._setCheckbox('modal-enable-auto-toggle-strat', this.settings.features.enableAutoToggleStrat);
    this._setCheckbox('modal-enable-breakeven-trail', this.settings.features.enableBreakevenTrail);
    this._setCheckbox('modal-enable-candle-confirm', this.settings.features.enableCandleConfirm);
    this._setCheckbox('modal-enable-mtf-confirm', this.settings.features.enableMtfConfirm);
    this._setCheckbox('modal-enable-dynamic-sizing', this.settings.features.enableDynamicSizing);
    this._setCheckbox('modal-enable-tts', this.settings.features.enableTTS);
    const vEl = document.getElementById('modal-volume-spike-threshold');
    if (vEl) vEl.value = this.settings.signalThresholds.volumeSpikeThreshold;
    const pEl = document.getElementById('modal-profit-target-percent');
    if (pEl) pEl.value = this.settings.signalThresholds.profitTargetPercent;

    // Strateji toggles
    const box = document.getElementById('modal-strategy-toggles');
    if (box) {
      box.innerHTML = this.strategyKeys.map((key) => {
        const inst = this.strategies[key];
        const checked = inst._isLive ? 'checked' : '';
        return `<label class="checkbox-label"><input type="checkbox" data-strategy="${key}" ${checked}> ${inst?.displayName || key}</label>`;
      }).join('');
      box.querySelectorAll('[data-strategy]').forEach((el) => {
        el.addEventListener('change', () => {
          this.strategies[el.dataset.strategy]?.setIsLive(el.checked);
          this.notify.info(`${this.strategies[el.dataset.strategy].displayName} ${el.checked ? 'aktif' : 'pasif'}.`);
        });
      });
    }
    this._populateVoices();
  }

  _populateVoices() {
    const sel = document.getElementById('modal-tts-voice-select');
    if (!sel) return;
    const voices = this.tts.getVoices();
    if (!voices.length) return;
    sel.innerHTML = voices.map((v) => `<option value="${v.voiceURI}">${v.name} (${v.lang})</option>`).join('');
    sel.onchange = () => this.tts.setVoice(sel.value);
  }

  _setCheckbox(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = !!checked;
  }

  saveSettingsFromModal() {
    const num = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const bool = (id) => !!document.getElementById(id)?.checked;

    this.settings.confluenceThreshold = num('modal-confluence-threshold');
    this.settings.params.rsiPeriod = num('modal-param-rsi-period');
    this.settings.params.atrPeriod = num('modal-param-atr-period');
    this.settings.params.wallBtc = num('modal-param-wall-btc');
    this.settings.params.rrRatio = num('modal-param-rr-ratio');
    this.settings.cooldowns.signalMs = num('modal-signal-cooldown-ms');
    this.settings.cooldowns.sameDirectionMs = num('modal-same-direction-cooldown-ms');
    this.settings.cooldowns.oppositeDirectionMs = num('modal-opposite-direction-cooldown-ms');
    this.settings.cooldowns.reverseHysteresisPoints = num('modal-reverse-hysteresis-points');
    this.settings.cooldowns.proposalTimeoutMs = num('modal-proposal-timeout-ms');
    this.settings.cooldowns.strategyProposalMs = num('modal-strategy-proposal-cooldown-ms');
    this.settings.breakeven.beAtR = num('modal-be-at-r');
    this.settings.breakeven.trailAfterR = num('modal-trail-after-r');
    this.settings.breakeven.trailToR = num('modal-trail-to-r');
    this.settings.features.mtfTimeframe = document.getElementById('modal-mtf-timeframe')?.value || '15m';

    this.settings.features.enableSpoofDetection = bool('modal-enable-spoof-detection');
    this.settings.features.enableCUSUMDrift = bool('modal-enable-cusum-drift');
    this.settings.features.enableRiskGuardian = bool('modal-enable-risk-guardian');
    this.settings.features.enableAutoOptimize = bool('modal-enable-auto-optimize');
    this.settings.features.enableAutoToggleStrat = bool('modal-enable-auto-toggle-strat');
    this.settings.features.enableBreakevenTrail = bool('modal-enable-breakeven-trail');
    this.settings.features.enableCandleConfirm = bool('modal-enable-candle-confirm');
    this.settings.features.enableMtfConfirm = bool('modal-enable-mtf-confirm');
    this.settings.features.enableDynamicSizing = bool('modal-enable-dynamic-sizing');
    this.settings.features.enableTTS = bool('modal-enable-tts');
    const vVal = parseFloat(document.getElementById('modal-volume-spike-threshold')?.value);
    if (!isNaN(vVal)) this.settings.signalThresholds.volumeSpikeThreshold = vVal;
    const pVal = parseFloat(document.getElementById('modal-profit-target-percent')?.value);
    if (!isNaN(pVal)) this.settings.signalThresholds.profitTargetPercent = pVal;

    this.tts.setEnabled(this.settings.features.enableTTS);
    this.saveSettings();
    this.closeSettingsModal();
    this.notify.success('Ayarlar kaydedildi.');
  }

  resetAllSettings() {
    this.settings = safeClone(DEFAULT_SETTINGS);
    this.saveSettings();
    this.closeSettingsModal();
    this.notify.warning('Tüm ayarlar sıfırlandı.');
  }

  // ── Fullscreen / görünüm ─────────────────────────────
  enterFullscreenChart() {
    document.body.classList.add('fullscreen-chart');
    setTimeout(() => this.chartManager?.resize(), 100);
  }

  exitFullscreenChart() {
    document.body.classList.remove('fullscreen-chart');
    setTimeout(() => this.chartManager?.resize(), 100);
  }

  // ── Şeref Tablosu / Banlılar (Patch #7) ──────────────────
  openHonorModal(filter = 'all') {
    const el = document.getElementById('honor-modal-body');
    if (!el) return;
    const honor = [], shame = [], banned = [];
    const minContrib = 10;
    for (const key of this.strategyKeys) {
      const st = this.strategyStats[key]?.overall || {};
      const w = this.getStrategyWeight(key);
      const active = !!this.settings.activeStrategies[key];
      const isShadow = !!this.settings.statusMaps.shadowBanned[key];
      const isHard = !!this.settings.statusMaps.hardBanned[key];
      const contrib = st.contrib || 0;
      const wins = (st.wins || 0) + (st.shadowWins || 0);
      const losses = (st.losses || 0) + (st.shadowLosses || 0);
      const total = wins + losses;
      const wr = total > 0 ? (wins / total * 100) : 0;
      const row = { key, name: this.strategies[key]?.displayName || key, w, wr, contrib, status: isHard ? 'HARDBAN' : (isShadow ? 'GÖLGE' : (active ? 'CANLI' : 'PASİF')) };
      if (isShadow || isHard) banned.push(row);
      if (!isShadow && !isHard) {
        if (w >= 1.1 && total >= minContrib) honor.push(row);
        else if (w <= 0.8 && contrib >= minContrib) shame.push(row);
      }
    }
    const pickRogue = shame.sort((a,b) => a.w - b.w)[0];
    const renderList = (title, arr, empty='-') => `
      <div class="panel-title" style="margin:6px 0;">${title}</div>
      <div class="data-table-container" style="max-height:240px;">
        <table class="data-table">
          <thead><tr><th>Strateji</th><th>w</th><th>WR%</th><th>Katkı</th><th>Durum</th><th>Aksiyon</th></tr></thead>
          <tbody>
            ${arr.length ? arr.map(r => `
              <tr>
                <td>${r.name}</td><td>${r.w.toFixed(2)}</td><td>${r.wr.toFixed(0)}</td><td>${r.contrib}</td><td>${r.status}</td>
                <td>
                  <button class="btn btn-tiny" onclick="window.app.toggleShadow('${r.key}')">${this.settings.statusMaps.shadowBanned[r.key]?'Gölgeden Al':'Gölge'}</button>
                  <button class="btn btn-tiny" onclick="window.app.toggleHardBan('${r.key}')">${this.settings.statusMaps.hardBanned[r.key]?'Unban':'HardBan'}</button>
                  <button class="btn btn-tiny" onclick="window.app.openStrategySurgery('${r.key}')">Ameliyat</button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="6">${empty}</td></tr>`}
          </tbody>
        </table>
      </div>`;
    let html = '';
    if (filter === 'banned') {
      html += renderList('Banlılar (Gölge/HardBan)', banned, 'Kimse banlı değil.');
    } else {
      if (pickRogue) {
        html += `<div class="notification danger" style="position:relative; margin-bottom:10px;">Günün şerefsizi: <b>${pickRogue.name}</b> (w=${pickRogue.w.toFixed(2)})</div>`;
        if (this.settings.features.enableTTS) this.speak(this.getRandomMessage('rogueOfDay', { 'Strateji': pickRogue.name }));
      }
      html += renderList('Şerefli (güçlüler)', honor.sort((a,b)=>b.w-a.w), 'Şimdilik yok.');
      html += renderList('Şerefsizler (zayıflar)', shame.sort((a,b)=>a.w-b.w), 'Bugün herkes uslu.');
      html += renderList('Banlılar (Gölge/HardBan)', banned, 'Kimse banlı değil.');
    }
    el.innerHTML = html;
    const overlay = document.getElementById('honor-modal-overlay');
    if (overlay) overlay.style.display = 'flex';
    this.lastHonorModalFilter = filter;
  }

  closeHonorModal() {
    const overlay = document.getElementById('honor-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  toggleShadow(key) {
    const cur = !!this.settings.statusMaps.shadowBanned[key];
    this.settings.statusMaps.shadowBanned[key] = !cur;
    this.settings.activeStrategies[key] = cur ? true : false;
    this.updateActiveStrategies();
    this.saveSettings();
    this.openHonorModal(this.lastHonorModalFilter);
    this.showNotification(`${this.strategies[key].displayName} ${cur ? 'gölgeden alındı' : 'gölgeye alındı'}.`, 'info');
    if (this.settings.features.enableTTS) this.speak(this.getRandomMessage(cur ? 'shadowRehab' : 'shadowBan', { 'Strateji': this.strategies[key].displayName }));
  }

  toggleHardBan(key) {
    const cur = !!this.settings.statusMaps.hardBanned[key];
    this.settings.statusMaps.hardBanned[key] = !cur;
    if (this.settings.statusMaps.hardBanned[key]) {
      this.settings.statusMaps.shadowBanned[key] = true;
      this.settings.activeStrategies[key] = false;
    } else {
      this.settings.statusMaps.shadowBanned[key] = false;
    }
    this.updateActiveStrategies();
    this.saveSettings();
    this.openHonorModal(this.lastHonorModalFilter);
    this.showNotification(`${this.strategies[key].displayName} ${cur ? 'hardbandan çıkarıldı' : 'hardban edildi'}.`, cur ? 'success' : 'danger');
  }

  openStrategySurgery(key) {
    const defs = this.settings.strategyParams[key] || {};
    let form = `<div class="panel-title" style="margin-top:10px;">${this.strategies[key].displayName} - Ameliyat</div>`;
    form += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0;">`;
    for (const k of Object.keys(defs)) {
      form += `<label style="font-size:11px; color:var(--text-secondary)">${k}</label><input type="number" step="0.000001" value="${defs[k]}" data-par="${k}" data-strat="${key}" class="form-control strat-par-input">`;
    }
    form += `</div><button class="btn btn-success btn-sm" onclick="window.app.saveStrategySurgery('${key}')">Kaydet</button>`;
    const el = document.getElementById('honor-modal-body');
    if (!el) return;
    el.insertAdjacentHTML('beforeend', form);
    el.querySelectorAll('.strat-par-input').forEach(inp=>{
      inp.addEventListener('change', (e)=>{
        const strat = e.target.dataset.strat;
        const par = e.target.dataset.par;
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) this.settings.strategyParams[strat][par] = val;
      });
    });
  }

  saveStrategySurgery(key) {
    this.saveSettings();
    this.applyStrategyParamOverrides();
    this.showNotification(`${this.strategies[key].displayName} parametreleri güncellendi.`, 'success');
    this.openHonorModal(this.lastHonorModalFilter);
  }

  setView(view) {
    this.currentMainView = view;
    this.ui.setView(view);
    this.saveData('utc_current_view', view);
  }

  toggleHeader() {
    this.ui.toggleHeader();
  }

  togglePanteon() {
    this.ui.togglePanteon();
  }
}

export default UltimateTradingCommandCenter;
