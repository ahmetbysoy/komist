/**
 * BybitStream — Bybit Futures WebSocket (Borsa-agnostik arayüz, Faz D stub)
 * BinanceStream ile aynı handler sözleşmesini uygular:
 *   { onTicker, onDepth, onKline, onAggTrade, onForceOrder, onMarkPrice, onStatus }
 *
 * Şu an stub: gerçek Bybit WS bağlanmaz, sadece log basar ve mock'a düşürür.
 * İleride gerçek endpoint'lerle doldurulacak:
 *   wss://stream.bybit.com/v5/public/linear  (ticker, orderbook, trade, kline)
 *   wss://stream.bybit.com/v5/public/linear  (liquidation)
 *
 * Kullanım: new ExchangeManager(bot, BybitStream)
 */
import { Logger } from '../core/Logger.js';

export class BybitStream {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.symbol = null;
    this.timeframe = null;
    this.isRunning = false;
    this.manualClose = false;
  }

  connect(symbol, timeframe) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.isRunning = true;
    this.manualClose = false;
    Logger.warn('BybitStream', `Bybit ${symbol}@${timeframe} stub — henüz gerçek WS yok, mock'a düşülüyor (Faz D TODO)`);
    this.handlers.onStatus?.('reconnecting', 3000);
    // Gerçek implementasyon için örnek:
    // const streams = [`orderbook.50.${symbol}`, `publicTrade.${symbol}`, `kline.${timeframe}.${symbol}`, `tickers.${symbol}`];
    // this.ws = new WebSocket(`wss://stream.bybit.com/v5/public/linear`);
    // ws.on('subscribe', ...) vb.
    // Şimdilik 3sn sonra off durumuna geç, ExchangeManager mock'a düşürecek
    setTimeout(() => {
      if (!this.manualClose) this.handlers.onStatus?.('off');
    }, 1000);
  }

  close() {
    this.manualClose = true;
    this.isRunning = false;
    this.handlers.onStatus?.('off');
    Logger.info('BybitStream', 'Kapatıldı (stub)');
  }

  // Geriye dönük uyum için ws getter
  get ws() { return null; }
  get publicWs() { return null; }
  get marketWs() { return null; }
  get lastSeen() { return { ticker: 0, depth: 0, kline: 0, aggTrade: 0, any: 0 }; }
}

export default BybitStream;
