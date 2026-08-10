/**
 * STATE — Çalışma zamanı verisi (barva35.html referansı)
 * Tekil nesne; tüm modüller buraya yazar, UI buradan okur.
 */
export const STATE = {
  symbol: 'BTCUSDT',
  timeframe: '15m',
  connected: false,
  connectionText: 'BAĞLANTI YOK',
  running: false,
  lastPrice: 0,

  marketData: { price: 0, change24h: 0, volume24h: 0, symbol: 'BTCUSDT', btcPrice: 70000 },
  orderBook: { bids: [], asks: [], lastUpdateId: null },
  candles: [],
  indicators: { rsi: [], atr: null, sma20: null, sma50: null, volSma20: null, vwap: null, adx: null, bbands: null },

  signals: [],
  pendingSignals: [],
  stats: { total: 0, tp: 0, sl: 0 },
  strategyStats: {},
  shadowProposals: [],

  marketRegime: 'unknown',
  sessionState: 'unknown',
  riskState: 'neutral',
  horseman: null,

  positions: [],
  activeView: 'chart',           // 'chart' | 'heatmap'
  headerCollapsed: true,
  theme: 'dark',

  // Strateji instanceları (App kurar)
  strategies: {}
};

export default STATE;
