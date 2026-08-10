/**
 * BinanceStream — Combined WebSocket (barva35.html referansı)
 * Streamler: {sym}@ticker | {sym}@depth20@100ms | {sym}@aggTrade | {sym}@kline_{tf}
 * Yeniden bağlanma: exponential backoff (3s → 6s → 12s → 24s → 30s cap)
 */
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class BinanceStream {
  /**
   * @param {Object} handlers { onTicker, onDepth, onKline, onAggTrade, onStatus }
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.symbol = null;
    this.timeframe = null;
    this.attempts = 0;
    this.reconnectTimer = null;
    this.manualClose = false;
    this.isRunning = false;
  }

  connect(symbol, timeframe) {
    this.manualClose = false;
    this.isRunning = true;
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.attempts = 0;

    const sym = symbol.toLowerCase();
    const streams = [
      `${sym}@ticker`,
      `${sym}@depth20@100ms`,
      `${sym}@aggTrade`,
      `${sym}@kline_${timeframe}`
    ];
    const url = CONFIG.exchange.binanceWs + streams.join('/');

    this.handlers.onStatus?.('connecting');
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      Logger.error('BinanceStream', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus?.('online');
      Logger.info('BinanceStream', `${symbol}@${timeframe} bağlandı`);
    };

    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }
      const stream = msg.stream || '';
      const data = msg.data || {};
      const type = stream.split('@')[1] || '';

      if (type === 'ticker') this.handlers.onTicker?.(data);
      else if (type.startsWith('depth')) this.handlers.onDepth?.(data);
      else if (type.startsWith('kline')) this.handlers.onKline?.(data);
      else if (type === 'aggTrade') this.handlers.onAggTrade?.(data);
    };

    this.ws.onerror = () => Logger.warn('BinanceStream', 'WS hatası');
    this.ws.onclose = () => {
      if (!this.manualClose && this.isRunning) this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    const base = CONFIG.exchange.reconnectBaseMs;
    const cap = CONFIG.exchange.reconnectCapMs;
    this.attempts += 1;
    const delay = Math.min(cap, base * 2 ** (this.attempts - 1));
    this.handlers.onStatus?.('reconnecting', delay);
    Logger.info('BinanceStream', `${delay / 1000}s sonra yeniden bağlanılıyor (deneme ${this.attempts})`);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.manualClose && this.isRunning) this.connect(this.symbol, this.timeframe);
    }, delay);
  }

  close() {
    this.manualClose = true;
    this.isRunning = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'İstemci tarafından kapatıldı');
      this.ws = null;
    }
    this.handlers.onStatus?.('off');
  }
}

export default BinanceStream;
