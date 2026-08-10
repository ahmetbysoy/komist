/**
 * OKXStream — OKX Futures WebSocket (Borsa-agnostik arayüz, Faz D stub)
 * BinanceStream ile aynı handler sözleşmesini uygular:
 *   { onTicker, onDepth, onKline, onAggTrade, onForceOrder, onMarkPrice, onStatus }
 *
 * Şu an stub: gerçek OKX WS bağlanmaz, sadece log basar.
 * İleride gerçek endpoint'lerle doldurulacak:
 *   wss://ws.okx.com:8443/ws/v5/public  (tickers, books, trades, liquidations, markPrice)
 *
 * Kullanım: new ExchangeManager(bot, OKXStream)
 */
import { Logger } from '../core/Logger.js';

export class OKXStream {
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
    Logger.warn('OKXStream', `OKX ${symbol}@${timeframe} stub — henüz gerçek WS yok, mock'a düşülüyor (Faz D TODO)`);
    this.handlers.onStatus?.('reconnecting', 3000);
    // Gerçek implementasyon için örnek:
    // const args = [
    //   { channel: 'tickers', instId: symbol.replace('USDT','-USDT') },
    //   { channel: 'books', instId: symbol.replace('USDT','-USDT') },
    //   { channel: 'trades', instId: symbol.replace('USDT','-USDT') },
    //   { channel: 'liquidation-orders', instId: 'USDT' }
    // ];
    // this.ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
    setTimeout(() => {
      if (!this.manualClose) this.handlers.onStatus?.('off');
    }, 1000);
  }

  close() {
    this.manualClose = true;
    this.isRunning = false;
    this.handlers.onStatus?.('off');
    Logger.info('OKXStream', 'Kapatıldı (stub)');
  }

  get ws() { return null; }
  get publicWs() { return null; }
  get marketWs() { return null; }
  get lastSeen() { return { ticker: 0, depth: 0, kline: 0, aggTrade: 0, any: 0 }; }
}

export default OKXStream;
