/**
 * BinanceStream — Dual Routed WebSocket (P0 WS Migration)
 * Binance 2026-04-23'te legacy tek URL'yi kaldırdı, artık routed endpoint var:
 *  - wss://fstream.binance.com/public  → depth / bookTicker (yüksek frekanslı public)
 *  - wss://fstream.binance.com/market  → ticker / kline / aggTrade / forceOrder / markPrice
 *
 * Eski tek URL (wss://fstream.binance.com/stream) artık sadece /public verisi taşıyor.
 * Bu sınıf 2 WebSocket'i paralel yönetir, tek bir dispatch ile App'e iletir.
 * + Watchdog: her stream tipi için lastSeen tutar, sessiz kalırsa uyarı/reconnect tetikler.
 *
 * Streamler: {sym}@ticker | {sym}@depth20@100ms | {sym}@aggTrade | {sym}@kline_{tf}
 * Yeniden bağlanma: her soket için bağımsız exponential backoff (3s→30s cap)
 */
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class BinanceStream {
  /**
   * @param {Object} handlers { onTicker, onDepth, onKline, onAggTrade, onForceOrder, onMarkPrice, onStatus }
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.symbol = null;
    this.timeframe = null;

    // Dual sockets
    this.publicWs = null;
    this.marketWs = null;

    this.publicAttempts = 0;
    this.marketAttempts = 0;

    this.publicTimer = null;
    this.marketTimer = null;

    this.manualClose = false;
    this.isRunning = false;

    // Watchdog
    this.lastSeen = { ticker: 0, depth: 0, kline: 0, aggTrade: 0, any: 0 };
    this.watchdogTimer = null;
  }

  connect(symbol, timeframe) {
    this.manualClose = false;
    this.isRunning = true;
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.publicAttempts = 0;
    this.marketAttempts = 0;

    this._clearTimers();
    this._closeSockets();
    this._startWatchdog();

    this.handlers.onStatus?.('connecting');
    Logger.info('BinanceStream', `Bağlanıyor: ${symbol}@${timeframe} → public+market (dual routed)`);

    this._connectPublic();
    this._connectMarket();
  }

  // ── Public soketi (depth vb) ───────────────────────
  _connectPublic() {
    const sym = this.symbol.toLowerCase();
    const streams = [
      `${sym}@depth20@100ms`
      // İleride eklenebilir: `${sym}@bookTicker`
    ];
    const base = CONFIG.exchange.binanceWsPublic || CONFIG.exchange.binanceWs;
    const url = base + streams.join('/');

    Logger.info('BinanceStream', `Public WS: ${url}`);
    try {
      this.publicWs = new WebSocket(url);
    } catch (e) {
      Logger.error('BinanceStream', 'Public WS oluşturma hatası:', e);
      this._scheduleReconnectPublic();
      return;
    }

    this.publicWs.onopen = () => {
      this.publicAttempts = 0;
      Logger.info('BinanceStream', `✅ Public WS bağlandı (${this.symbol} depth)`);
      this._updateCombinedStatus();
      this.lastSeen.any = Date.now();
    };

    this.publicWs.onmessage = (e) => this._handleMessage(e, 'public');

    this.publicWs.onerror = () => {
      Logger.warn('BinanceStream', 'Public WS hatası');
    };

    this.publicWs.onclose = (ev) => {
      Logger.warn('BinanceStream', `Public WS kapandı code=${ev.code} reason=${ev.reason}`);
      this.publicWs = null;
      this._updateCombinedStatus();
      if (!this.manualClose && this.isRunning) this._scheduleReconnectPublic();
    };
  }

  // ── Market soketi (ticker/kline/aggTrade) ──────────
  _connectMarket() {
    const sym = this.symbol.toLowerCase();
    const streams = [
      `${sym}@ticker`,
      `${sym}@aggTrade`,
      `${sym}@kline_${this.timeframe}`,
      `!forceOrder@arr`,
      `${sym}@markPrice@1s`
    ];
    const base = CONFIG.exchange.binanceWsMarket || CONFIG.exchange.binanceWs;
    const url = base + streams.join('/');

    Logger.info('BinanceStream', `Market WS: ${url}`);
    try {
      this.marketWs = new WebSocket(url);
    } catch (e) {
      Logger.error('BinanceStream', 'Market WS oluşturma hatası:', e);
      this._scheduleReconnectMarket();
      return;
    }

    this.marketWs.onopen = () => {
      this.marketAttempts = 0;
      Logger.info('BinanceStream', `✅ Market WS bağlandı (${this.symbol} ticker/kline/aggTrade)`);
      this._updateCombinedStatus();
      this.lastSeen.any = Date.now();
    };

    this.marketWs.onmessage = (e) => this._handleMessage(e, 'market');

    this.marketWs.onerror = () => {
      Logger.warn('BinanceStream', 'Market WS hatası');
    };

    this.marketWs.onclose = (ev) => {
      Logger.warn('BinanceStream', `Market WS kapandı code=${ev.code} reason=${ev.reason}`);
      this.marketWs = null;
      this._updateCombinedStatus();
      if (!this.manualClose && this.isRunning) this._scheduleReconnectMarket();
    };
  }

  // ── Ortak mesaj dispatch ───────────────────────────
  _handleMessage(e, source) {
    let msg;
    try { msg = JSON.parse(e.data); } catch (_) { return; }
    const stream = msg.stream || '';
    const data = msg.data || msg; // bazı endpointler direkt data döner
    const at = stream.split('@')[1] || '';

    const now = Date.now();
    this.lastSeen.any = now;

    // Watchdog güncellemesi
    if (at === 'ticker' || stream.includes('@ticker')) {
      this.lastSeen.ticker = now;
      this.handlers.onTicker?.(data);
    } else if (at.startsWith('depth') || stream.includes('depth')) {
      this.lastSeen.depth = now;
      this.handlers.onDepth?.(data);
    } else if (at.startsWith('kline') || stream.includes('kline')) {
      this.lastSeen.kline = now;
      this.handlers.onKline?.(data);
    } else if (at === 'aggTrade' || stream.includes('aggTrade')) {
      this.lastSeen.aggTrade = now;
      this.handlers.onAggTrade?.(data);
    } else if (at === 'trade' || stream.includes('@trade')) {
      // Ham trade stream'i (Binance @trade) → aggTrade handler'ına yönlendir (live testte public altında görülebiliyor)
      this.lastSeen.aggTrade = now;
      this.handlers.onAggTrade?.(data);
    } else if (at.startsWith('forceOrder') || stream.includes('forceOrder')) {
      this.lastSeen.aggTrade = now;
      // Binance !forceOrder@arr formatı: {o: {s, S, p, q, ...}} veya {s, S, p, q}
      const order = data.o || data;
      const forceOrder = {
        symbol: order.s || this.symbol,
        side: order.S || order.side || 'SELL', // S: SELL/BUY (likidasyon yönü)
        price: parseFloat(order.p || order.price || 0),
        quantity: parseFloat(order.q || order.quantity || 0),
        notional: parseFloat(order.q || 0) * parseFloat(order.p || 0),
        ts: order.T || Date.now(),
        raw: data
      };
      // Sadece ilgili sembol için filtrele (all-arr ise)
      if (forceOrder.symbol === this.symbol || stream === '!forceOrder@arr') {
        this.handlers.onForceOrder?.(forceOrder);
      }
    } else if (at.startsWith('markPrice') || stream.includes('markPrice')) {
      this.lastSeen.ticker = now;
      this.handlers.onMarkPrice?.(data);
    } else {
      // Bilinmeyen stream — yine de logla (sessiz kesilmeyi fark etmek için)
      Logger.debug('BinanceStream', `Bilinmeyen stream (${source}): ${stream}`);
    }
  }

  // ── Reconnect (her soket bağımsız) ─────────────────
  _scheduleReconnectPublic() {
    const base = CONFIG.exchange.reconnectBaseMs;
    const cap = CONFIG.exchange.reconnectCapMs;
    this.publicAttempts += 1;
    const delay = Math.min(cap, base * 2 ** (this.publicAttempts - 1));
    this.handlers.onStatus?.('reconnecting', delay);
    Logger.info('BinanceStream', `Public ${delay / 1000}s sonra yeniden bağlanıyor (deneme ${this.publicAttempts})`);
    clearTimeout(this.publicTimer);
    this.publicTimer = setTimeout(() => {
      if (!this.manualClose && this.isRunning) this._connectPublic();
    }, delay);
  }

  _scheduleReconnectMarket() {
    const base = CONFIG.exchange.reconnectBaseMs;
    const cap = CONFIG.exchange.reconnectCapMs;
    this.marketAttempts += 1;
    const delay = Math.min(cap, base * 2 ** (this.marketAttempts - 1));
    this.handlers.onStatus?.('reconnecting', delay);
    Logger.info('BinanceStream', `Market ${delay / 1000}s sonra yeniden bağlanıyor (deneme ${this.marketAttempts})`);
    clearTimeout(this.marketTimer);
    this.marketTimer = setTimeout(() => {
      if (!this.manualClose && this.isRunning) this._connectMarket();
    }, delay);
  }

  // ── Birleşik durum raporlama ───────────────────────
  _updateCombinedStatus() {
    const pubOpen = this.publicWs?.readyState === 1;
    const mktOpen = this.marketWs?.readyState === 1;

    if (pubOpen && mktOpen) {
      this.handlers.onStatus?.('online');
    } else if (pubOpen || mktOpen) {
      // Biri açık biri kapalı → yarı bağlı (degrade)
      const which = !pubOpen ? 'public' : 'market';
      Logger.warn('BinanceStream', `Yarı bağlı: ${which} down, diğer açık`);
      this.handlers.onStatus?.('reconnecting', 3000);
    } else if (!this.manualClose && this.isRunning) {
      // İkisi de kapalı ama biz kapatmadık → reconnecting
      // onStatus zaten _scheduleReconnect'te çağrılıyor
    } else {
      this.handlers.onStatus?.('off');
    }
  }

  // ── Watchdog: sessiz stream tespiti ────────────────
  _startWatchdog() {
    this._stopWatchdog();
    const checkMs = CONFIG.exchange.watchdogCheckMs || 30000;
    const staleMs = CONFIG.exchange.watchdogMs || 60000;

    this.watchdogTimer = setInterval(() => {
      if (!this.isRunning || this.manualClose) return;
      const now = Date.now();
      const silent = [];
      for (const [key, ts] of Object.entries(this.lastSeen)) {
        if (key === 'any') continue;
        if (ts === 0) continue; // henüz hiç gelmediyse ilk bağlantıda sessiz sayma (ilk 90sn tolerans)
        if (now - ts > staleMs) silent.push(`${key} ${Math.round((now - ts) / 1000)}s sessiz`);
      }
      // any hiç gelmediyse (her ikisi de sessiz)
      if (this.lastSeen.any !== 0 && now - this.lastSeen.any > staleMs) {
        silent.push(`any ${Math.round((now - this.lastSeen.any) / 1000)}s sessiz (her iki soket)`);
      }

      if (silent.length) {
        const msg = `⚠️ Watchdog: ${silent.join(', ')} — soket açık ama veri gelmiyor (routed path hatası olabilir)`;
        Logger.warn('BinanceStream', msg);
        // Kullanıcıya somut uyarı (App.notify.warning)
        // onStatus üzerinden App'e iletmek yerine doğrudan log + status
        this.handlers.onStatus?.('reconnecting', 5000);
        // Sessiz kalan soketi zorla yenile
        // Hangi soket hangi stream'i taşıyorsa ona göre karar ver
        const needPublic = silent.some(s => s.startsWith('depth'));
        const needMarket = silent.some(s => s.startsWith('ticker') || s.startsWith('kline') || s.startsWith('aggTrade'));

        if (needPublic && this.publicWs) {
          Logger.warn('BinanceStream', 'Watchdog → Public WS yeniden bağlanıyor');
          try { this.publicWs.close(1000, 'watchdog public silent'); } catch (_) {}
        }
        if (needMarket && this.marketWs) {
          Logger.warn('BinanceStream', 'Watchdog → Market WS yeniden bağlanıyor');
          try { this.marketWs.close(1000, 'watchdog market silent'); } catch (_) {}
        }
        // Hiçbiri spesifik değilse (any sessiz) ikisini de yenile
        if (!needPublic && !needMarket && silent.some(s => s.startsWith('any'))) {
          Logger.warn('BinanceStream', 'Watchdog → Her iki WS yeniden bağlanıyor (any silent)');
          try { this.publicWs?.close(1000, 'watchdog any silent'); } catch (_) {}
          try { this.marketWs?.close(1000, 'watchdog any silent'); } catch (_) {}
        }
      }
    }, checkMs);
  }

  _stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  _clearTimers() {
    clearTimeout(this.publicTimer);
    clearTimeout(this.marketTimer);
    this.publicTimer = null;
    this.marketTimer = null;
  }

  _closeSockets() {
    if (this.publicWs) {
      try { this.publicWs.onclose = null; this.publicWs.close(1000, 'reconnect public'); } catch (_) {}
      this.publicWs = null;
    }
    if (this.marketWs) {
      try { this.marketWs.onclose = null; this.marketWs.close(1000, 'reconnect market'); } catch (_) {}
      this.marketWs = null;
    }
  }

  close() {
    this.manualClose = true;
    this.isRunning = false;
    this._clearTimers();
    this._stopWatchdog();
    this._closeSockets();
    this.handlers.onStatus?.('off');
    Logger.info('BinanceStream', 'Her iki WS kapatıldı');
  }

  // Geriye dönük uyum için tek ws getter (eski kod this.stream.ws diye erişirse)
  get ws() {
    return this.marketWs || this.publicWs;
  }
}

export default BinanceStream;
