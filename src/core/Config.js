/**
 * CONFIG — Sabit ayarlar (kaynak: BOZOK PRO §3 + UTC v2.0 §22 merge)
 * Tüm modüller bu nesneden okur; UI ayar değişiklikleri buraya yansır.
 */
export const CONFIG = {
  // ── Genel ─────────────────────────────────────────────
  defaultSymbol: 'BTCUSDT',
  depthLevels: 20,
  heatmapWindowSec: 30,
  staleThresholdMs: 5000,
  marketLatencyHaircutAfterMs: 150,
  useMockFallback: true,

  // ── Flow ──────────────────────────────────────────────
  flowTimeframeMs: 5000,
  flowMode: 'time',          // 'time' | 'volume'
  flowVolumeTarget: 1000000, // $ hedef notional

  // ── Dedektör ──────────────────────────────────────────
  wallMultiplier: 3.0,
  minConfidence: 60,
  spoofWindowSec: 3,

  // ── Risk / Paper Trading ──────────────────────────────
  balance: 1000,
  riskPct: 2,
  maxLeverage: 20,
  feeRateBps: 4,             // 0.04%
  minRR: 2.5,
  kellyFraction: 0.35,
  mmr: 0.004,                // Maintenance margin rate

  // ── Görünüm / Ses ─────────────────────────────────────
  theme: 'professional',     // 'professional' | 'neon' | 'minimal' | 'war'
  soundOn: false,
  voiceAnnounce: false,

  // ── UTC Confluence ────────────────────────────────────
  confluence: {
    signalMs: 15000,
    sameDirectionMs: 30000,
    oppositeDirectionMs: 20000,
    reverseHysteresisPoints: 2,
    proposalTimeoutMs: 3000,
    strategyProposalMs: 10000,
    timeDecaySec: 3,
    dirMargin: 0.5,
    minContributors: 2,
    minGroups: 1,
    threshold: 3
  },

  // ── Gating ────────────────────────────────────────────
  gating: {
    enabled: true,
    spreadMaxPct: 0.001,     // %0.1
    minDepthUsd: 50000
  },

  // ── TP/SL & Breakeven ─────────────────────────────────
  tpSl: {
    atrPeriod: 14,
    rrRatioBase: 1.5,
    breakeven: { enabled: true, beAtR: 0.8 },
    trailing: { enabled: true, trailAfterR: 1.5, trailToR: 0.5 }
  },

  // ── Oto-optimizasyon ──────────────────────────────────
  optimization: {
    enabled: true,
    autoToggle: true,
    minWeightToStay: 0.60,
    minContribForToggle: 30
  },

  // ── Panteon ───────────────────────────────────────────
  panteon: {
    reputationBounds: { min: -100, max: 100 },
    reputationWeights: {
      tpContributor: 1.0,
      tpRaphael: 0.5,
      slAll: -2.0,
      slResponsibleExtra: -3.0,
      dormancyPenalty: -1.0
    },
    modeThresholds: { inanc: 20, kiyamet: -10 },
    dormancyHours: 4,
    whisperTtlMs: 1800000    // 30 dk fısıltı
  },

  // ── Oracle (4 Atlı) ───────────────────────────────────
  oracle: {
    warAtrPct: 0.02,
    famineVolFactor: 0.6,
    plagueDropPct: -0.015,
    deathTrendAdx: 18,
    checkIntervalMs: 7000
  },

  // ── Veri ──────────────────────────────────────────────
  exchange: {
    binanceWs: 'wss://fstream.binance.com/stream?streams=',
    binanceRest: 'https://fapi.binance.com',
    pollingMs: 3000,
    reconnectBaseMs: 3000,
    reconnectCapMs: 30000,
    crossExchanges: ['bybit', 'okx', 'mexc']
  },

  // ── Zebani (bad tick) ─────────────────────────────────
  zebani: {
    enabled: true,
    jumpPct: 0.015,          // %1.5 sıçrama
    windowMs: 500
  }
};

export default CONFIG;
