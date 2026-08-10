/**
 * CONFIG — Varsayılan ayarlar (barva35.html referansı — UTC v2.0 §22)
 * UI ayar değişiklikleri `settings` üzerinden uygulanır; bu nesne varsayılanları taşır.
 */
export const DEFAULT_SETTINGS = {
  // ── Temel parametreler ───────────────────────────────
  confluenceThreshold: 3,
  params: { rsiPeriod: 14, atrPeriod: 14, wallBtc: 20, rrRatio: 1.5 },

  // ── Cooldown ayarları ────────────────────────────────
  cooldowns: {
    signalMs: 15000,
    sameDirectionMs: 30000,
    oppositeDirectionMs: 20000,
    reverseHysteresisPoints: 2,
    proposalTimeoutMs: 3000,
    strategyProposalMs: 10000
  },

  // ── Gelişmiş özellikler ──────────────────────────────
  features: {
    enableSpoofDetection: true,
    enableCUSUMDrift: true,
    enableRiskGuardian: true,
    enableAutoOptimize: true,
    enableAutoToggleStrat: true,
    enableBreakevenTrail: true,
    enableCandleConfirm: true,
    enableMtfConfirm: true,
    mtfTimeframe: '15m',
    enableDynamicSizing: true,
    enableTTS: true
  },

  // ── Breakeven & Trailing ─────────────────────────────
  breakeven: { beAtR: 0.8, trailAfterR: 1.5, trailToR: 0.5 },

  // ── Sinyal eşikleri (yapay zeka hafızası için) ─────────
  signalThresholds: {
    volumeSpikeThreshold: 5,
    profitTargetPercent: 0.2,
    strongBuyRatio: 0.55,
    wallVolumeMultiplier: 1.5
  },

  // ── Oto-optimizasyon ─────────────────────────────────
  optimization: {
    enabled: true,
    autoToggle: true,
    timeDecaySec: 3,
    dirMargin: 0.5,
    minWeightToStay: 0.60,
    minContribForToggle: 30,
    gating: { enabled: true, spreadMaxPct: 0.001, minDepthUsd: 50000 },
    signalQuality: { minContributors: 2, minGroups: 2 }
  },

  // ── Ceza sistemi (shadowban) ─────────────────────────
  penalties: {
    shadowEnabled: true,
    minWeightToShadow: 0.60,
    minContribForShadow: 30,
    rehabWinRate: 0.58,
    minShadowProposals: 20,
    coolOffMs: 30 * 60 * 1000
  },

  statusMaps: {
    shadowBanned: {},
    hardBanned: {}
  },

  activeStrategies: {},

  strategyParams: {
    wallBounce: { DISTANCE_THRESHOLD_PERCENT: 0.0005 },
    velocityScalping: { VELOCITY_WINDOW_MS: 2000, MIN_POINTS: 20, VELOCITY_THRESHOLD_PERCENT: 0.001 },
    liquidityGaps: { GAP_THRESHOLD_PERCENT: 0.001 },
    breakoutPattern: { LOOKBACK: 30, VOL_SPIKE: 1.4, BREAK_PCT: 0.0003 },
    supportResistance: { LOOKBACK: 60, THRESH: 0.0015 },
    fibonacciRetracement: { LOOKBACK: 120, TOL: 0.002 },
    vwapReversion: { MULT: 1.0 },
    superTrend: { MULT: 3.0, PERIOD: 14 },
    marketStructure: { SWING: 3 },
    institutionalOrderFlow: { TOP_N: 5, IMB_THRESHOLD: 2.0 },
    microSpreadArbitrage: { SPREAD_PCT: 0.0008 },
    volumeProfile: { PERIOD: 20, SPIKE: 2.0, CLOSE_POS: 0.7 },
    divergenceDetection: { LOOKBACK: 40, SWING_PERIOD: 3 }
  },

  // ── Risk ─────────────────────────────────────────────
  riskGuardian: { killSwitchWinRate: 35.0 },

  // ── Panteon ──────────────────────────────────────────
  panteon: {
    reputationBounds: { min: 0, max: 150 },
    dormancyHours: 4
  }
};

/** Genel sabitler */
export const CONFIG = {
  defaultSettings: DEFAULT_SETTINGS,
  defaultSymbol: 'BTCUSDT',
  defaultTimeframe: '15m',
  soundOn: false,
  voiceAnnounce: true,
  theme: 'dark',                // 'dark' | 'light' | 'war'
  balance: 1000,
  riskPct: 2,
  maxLeverage: 20,
  useMockFallback: true,
  staleThresholdMs: 5000,

  exchange: {
    // P0 WS MIGRATION (2026-04-23 legacy decommission): Binance artık routed endpoint kullanıyor
    // Public: depth/bookTicker gibi yüksek frekanslı emir defteri verisi
    // Market: ticker/kline/aggTrade/forceOrder/markPrice gibi piyasa verisi
    // Doküman: developers.binance.com — "Important WebSocket Change Notice"
    binanceWsPublic: 'wss://fstream.binance.com/public/stream?streams=',
    binanceWsMarket: 'wss://fstream.binance.com/market/stream?streams=',
    // Legacy tek URL (deprecated, sadece /public verisi taşır — geriye dönük fallback için tutuluyor)
    binanceWs: 'wss://fstream.binance.com/stream?streams=',
    binanceRest: 'https://fapi.binance.com',
    bybitRest: 'https://api.bybit.com',
    okxRest: 'https://www.okx.com',
    rest: {
      binance: 'https://fapi.binance.com/fapi/v1/klines',
      bybit: 'https://api.bybit.com/v5/market/kline',
      okx: 'https://www.okx.com/api/v5/market/candles'
    },
    reconnectBaseMs: 3000,
    reconnectCapMs: 30000,
    watchdogMs: 60000,          // stream sessiz kalma eşiği (Watchdog)
    watchdogCheckMs: 30000
  },
  // Faz D: Çoklu borsa seçeneği (Watchlist/Backtest/CloudSync REDDEDİLDİ - 10.08.2026, teklif edilmesin)
  exchanges: ['binance', 'bybit', 'okx'],
  defaultExchange: 'binance',

  zebani: {
    enabled: true,
    jumpPct: 0.015,
    windowMs: 500
  },

  session: {
    asia: [0, 8],       // UTC saat aralıkları
    london: [7, 16],
    newyork: [12, 21]
  }
};

export default CONFIG;
