/**
 * STATE — Çalışma zamanı verisi (kaynak: BOZOK PRO §3)
 * Tekil (singleton) — tüm motorlar buraya yazar, render buradan okur.
 */
export const STATE = {
  symbol: 'BTCUSDT',
  activeTab: 'book',
  activeLayers: ['liquidity', 'trades'],
  signalFilter: 'all',
  connected: false,
  lastPrice: 0,
  prevPrice: 0,
  priceChange24h: 0,
  lastBookUpdate: 0,
  lastTradeUpdate: 0,
  marketLatencyMs: 0,
  bookSeq: 0,
  stale: false,

  // Order Book
  book: { bids: [], asks: [], ts: 0, lastUpdateId: 0 },

  // Trade & CVD
  trades: [],
  liquidations: [],
  cvd: 0,
  cvdHistory: [],

  // VPIN
  vpin: {
    value: 0,
    label: 'Düşük',
    buckets: [],
    currentBuy: 0,
    currentSell: 0,
    currentNotional: 0,
    bucketSize: 500000
  },

  // Flow
  flowCandles: [],
  heatHistory: [],

  // Sinyaller & Plan
  signals: [],
  signalId: 0,
  narrative: 'Veri bekleniyor...',
  tradePlan: null,
  micro: null,

  // Çoklu borsa
  exchanges: {
    binance: { bid: 0, ask: 0, mid: 0, ts: 0, status: 'off' },
    bybit: { bid: 0, ask: 0, mid: 0, ts: 0, status: 'off' },
    okx: { bid: 0, ask: 0, mid: 0, ts: 0, status: 'off' },
    mexc: { bid: 0, ask: 0, mid: 0, ts: 0, status: 'off' }
  },

  // Performans
  performance: {
    trades: 0,
    wins: 0,
    netR: 0,
    pf: 0,
    sharpe: 0,
    maxDD: 0,
    equity: [0],
    avgHoldMs: 0
  },

  // Pozisyonlar
  positions: [],
  closedPositions: [],

  // Dedektör iç durumu
  detectorState: {
    walls: { bid: [], ask: [] },
    compressionActive: false,
    ladderCount: 0,
    spoofCandidates: [],
    icebergZones: [],
    lastSpoofCheck: 0
  },

  // UTC runtime
  marketData: { price: 0, change24h: 0, volume24h: 0, symbol: 'BTCUSDT', btcPrice: 70000 },
  candles: [],
  indicators: {},
  marketRegime: 'unknown',
  riskState: 'neutral',
  sessionState: 'unknown',
  strategies: {},          // strateji instanceları
  strategyStats: {},       // Bayesian α/β istatistikleri
  settings: {},
  signalsCount: 0,
  horseman: null,
  whisper: { bias: 0, until: 0 }
};

export default STATE;
