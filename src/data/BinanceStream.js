/**
 * BinanceStream — Combined WebSocket stream yöneticisi
 * Kaynak: BOZOK PRO §11 + UTC v2.0 §8
 *
 * Streamler: {sym}@depth@100ms | {sym}@aggTrade | {sym}@ticker | {sym}@forceOrder
 * Yeniden bağlanma: exponential backoff (3s → 6s → 12s → 24s → 30s cap)
 */
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class BinanceStream {
  /**
   * @param {Object} handlers { onDepth, onTrade, onTicker, onForceOrder, onStatus }
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.symbol = null;
    this.attempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.manualClose = false;
    this.status = 'off';
  }

  get url() {
    const s = this.symbol.toLowerCase();
    return CONFIG.exchange.binanceWs +
      `${s}@depth@100ms/${s}@aggTrade/${s}@ticker/${s}@forceOrder`;
  }

  connect(symbol) {
    this.manualClose = false;
    this.symbol = symbol;
    this._setStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      Logger.error('BinanceStream', 'WS kurulamadı:', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      Logger.info('BinanceStream', `${symbol} bağlandı`);
      this.attempts = 0;
      this._setStatus('online');
      this._startHeartbeat();
    };

    this.ws.onmessage = (e) => this._route(e.data);

    this.ws.onerror = () => {
      Logger.warn('BinanceStream', 'WS hatası');
      this._setStatus('error');
    };

    this.ws.onclose = () => {
      Logger.warn('BinanceStream', 'Bağlantı kapandı');
      this._setStatus('disconnected');
      if (!this.manualClose) this._scheduleReconnect();
    };
  }

  _route(raw) {
    let msg;
    try { msg = JSON.parse(raw); }
    catch (_) { return; }

    const stream = msg.stream || '';
    const data = msg.data || {};

    if (stream.endsWith('@depth@100ms')) {
      this.handlers.onDepth?.(data);
    } else if (stream.endsWith('@aggTrade')) {
      this.handlers.onTrade?.(data);
    } else if (stream.endsWith('@ticker')) {
      this.handlers.onTicker?.(data);
    } else if (stream.endsWith('@forceOrder') && data.o) {
      this.handlers.onForceOrder?.(data);
    } else if (data.e === 'ping' || data.ping) {
      // Binance WS periyodik ping gönderir; gerekiyorsa yanıtla
      this.ws?.send(JSON.stringify({ pong: Date.now() }));
    }
  }

  _startHeartbeat() {
    clearInterval(this.heartbeatTimer);
    // 10s'de bir yoklama — bağlantı canlılığı
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'PING' }));
      }
    }, 10000);
  }

  _scheduleReconnect() {
    const base = CONFIG.exchange.reconnectBaseMs;
    const cap = CONFIG.exchange.reconnectCapMs;
    this.attempts += 1;
    const delay = Math.min(cap, base * 2 ** (this.attempts - 1));
    Logger.info('BinanceStream', `${delay}ms sonra yeniden bağlanılıyor (deneme ${this.attempts})`);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.manualClose) this.connect(this.symbol);
    }, delay);
  }

  _setStatus(status) {
    this.status = status;
    this.handlers.onStatus?.(status);
  }

  close() {
    this.manualClose = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    this.ws?.close();
    this.ws = null;
    this._setStatus('off');
  }
}

export default BinanceStream;
