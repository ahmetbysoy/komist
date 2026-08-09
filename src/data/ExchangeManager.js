/**
 * ExchangeManager — Veri akışı orkestratörü
 * Kaynak: BOZOK PRO §11 + UTC v2.0 §8
 *
 * Akış:
 *  1. REST snapshot (depth) → applySnapshot
 *  2. WebSocket (4 combined stream) → diff + trade + ticker + forceOrder
 *  3. Cross-exchange polling (Bybit/OKX/MEXC) — 3s
 *  4. Mock fallback (useMockFallback)
 */
import { CONFIG } from '../core/Config.js';
import { STATE } from '../core/State.js';
import { Logger } from '../core/Logger.js';
import { num } from '../core/Utils.js';
import { BinanceStream } from './BinanceStream.js';
import { MockDataGenerator } from './MockDataGenerator.js';
import { ZebaniFilter } from './ZebaniFilter.js';

export class ExchangeManager {
  /**
   * @param {EventBus} bus
   * @param {Object} engines { micro, trade }
   */
  constructor(bus, engines) {
    this.bus = bus;
    this.micro = engines.micro;
    this.trade = engines.trade;

    this.stream = new BinanceStream({
      onDepth: (d) => this._onDepth(d),
      onTrade: (d) => this._onTrade(d),
      onTicker: (d) => this._onTicker(d),
      onForceOrder: (d) => this._onForceOrder(d),
      onStatus: (s) => this._onStatus(s)
    });

    this.zebani = new ZebaniFilter();
    this.mock = new MockDataGenerator(bus, {
      onBook: (s) => this.micro.applySnapshot(s.symbol || STATE.symbol, s),
      onTrade: (t) => this.trade.addTrade(t),
      onLiquidation: (l) => this.trade.addLiquidation(l)
    });

    this.pollTimer = null;
    this.mockActive = false;
  }

  async connect(symbol) {
    STATE.symbol = symbol;
    STATE.connected = false;
    this.stream.close();
    this.mock.stop();
    this.mockActive = false;

    // 1. REST snapshot — WS'ye geçmeden önce book'u kur
    const ok = await this._fetchSnapshot(symbol);

    // 2. WebSocket
    this.stream.connect(symbol);

    // 3. Cross-exchange polling
    this._startPolling();

    // 4. Mock fallback (snapshot başarısız olduysa)
    if (!ok && CONFIG.useMockFallback) {
      Logger.warn('Exchange', 'Gerçek veri alınamadı, mock moda geçiliyor');
      this.mockActive = true;
      this.mock.start(symbol);
    }
  }

  disconnect() {
    this.stream.close();
    this.mock.stop();
    clearInterval(this.pollTimer);
    STATE.connected = false;
  }

  // ── REST snapshot ─────────────────────────────────────
  async _fetchSnapshot(symbol) {
    try {
      const res = await fetch(
        `${CONFIG.exchange.binanceRest}/fapi/v1/depth?symbol=${symbol}&limit=100`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.micro.applySnapshot(symbol, data);
      Logger.info('Exchange', `Snapshot yüklendi: ${symbol} (${data.bids?.length || 0} bid)`);
      return true;
    } catch (e) {
      Logger.warn('Exchange', 'Snapshot hatası:', e.message);
      return false;
    }
  }

  // ── WS handlers ───────────────────────────────────────
  _onDepth(diff) {
    if (this.mockActive) return;
    this.micro.applyDiff(diff);
  }

  _onTrade(d) {
    if (this.mockActive) return;
    // Zebani filtresi fiyat sıçramaları için
    const price = num(d.p);
    if (!this.zebani.check(price)) return;
    this.trade.addTrade({
      price,
      qty: num(d.q),
      side: d.m ? 'sell' : 'buy',   // m=true → seller initiated → SELL
      ts: d.T,
      symbol: d.s,
      eventTime: d.E
    });
  }

  _onTicker(d) {
    STATE.priceChange24h = num(d.P) || 0;
    STATE.marketData.volume24h = num(d.q) || 0;
  }

  _onForceOrder(data) {
    const o = data.o;
    this.trade.addLiquidation({
      side: o.S,           // 'BUY' | 'SELL'
      price: num(o.p),
      qty: num(o.q),
      ts: o.T,
      symbol: o.s
    });
  }

  _onStatus(status) {
    const wasConnected = STATE.connected;
    STATE.connected = status === 'online';
    this.bus.emit('connection:update', { status, connected: STATE.connected });
    if (wasConnected !== STATE.connected) {
      Logger.info('Exchange', `Bağlantı: ${status}`);
    }
  }

  // ── Cross-exchange polling (3s) ───────────────────────
  _startPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this._pollAll(), CONFIG.exchange.pollingMs);
  }

  async _pollAll() {
    const jobs = {
      bybit: async () => {
        const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=' + STATE.symbol);
        const j = await r.json();
        return { bid: num(j?.result?.list?.[0]?.bid1Price), ask: num(j?.result?.list?.[0]?.ask1Price) };
      },
      okx: async () => {
        const r = await fetch('https://www.okx.com/api/v5/market/ticker?instId=' + STATE.symbol + '-USDT-SWAP');
        const j = await r.json();
        return { bid: num(j?.data?.[0]?.bidPx), ask: num(j?.data?.[0]?.askPx) };
      },
      mexc: async () => {
        const r = await fetch('https://contract.mexc.com/api/v1/contract/ticker?symbol=' + STATE.symbol);
        const j = await r.json();
        return { bid: num(j?.data?.bid1), ask: num(j?.data?.ask1) };
      }
    };

    for (const [name, fn] of Object.entries(jobs)) {
      try {
        const { bid, ask } = await fn();
        const ex = STATE.exchanges[name];
        ex.bid = bid; ex.ask = ask;
        ex.mid = bid && ask ? (bid + ask) / 2 : 0;
        ex.ts = Date.now();
        ex.status = bid > 0 ? 'ok' : 'off';
      } catch (_) {
        STATE.exchanges[name].status = 'err';
      }
    }
    this.bus.emit('exchanges:update', STATE.exchanges);
  }
}

export default ExchangeManager;
