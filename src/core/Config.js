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

  // ── Oto-optimizasyon ─────────────────────────────────
  optimization: {
    enabled: true,
    autoToggle: true,
    timeDecaySec: 3,
    dirMargin: 0.5,
    minWeightToStay: 0.60,
    minContribForToggle: 30,
    gating: { enabled: true, spreadMaxPct: 0.001, minDepthUsd: 50000 },
    signalQuality: { minContributors: 2, minGroups: 1 }
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
    reconnectBaseMs: 3000,
    reconnectCapMs: 30000,
    watchdogMs: 60000,          // stream sessiz kalma eşiği (Watchdog)
    watchdogCheckMs: 30000
  },

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
