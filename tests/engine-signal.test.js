import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignalEngine } from '../src/engines/SignalEngine.js';
import { STATE } from '../src/core/State.js';
import { EventBus } from '../src/core/EventBus.js';
import { sma } from '../src/indicators/SMA.js';
import { ema } from '../src/indicators/EMA.js';
import { rsi } from '../src/indicators/RSI.js';
import { atr } from '../src/indicators/ATR.js';

function setup() {
  STATE.signals = [];
  STATE.lastPrice = 100;
  STATE.stale = false;
  STATE.marketLatencyMs = 0;
  STATE.flowCandles = [];
  STATE.tradePlan = null;
  STATE.micro = null;
  return new SignalEngine(new EventBus());
}

test('sinyal ekleme + dedup (10s, %0.05)', () => {
  const se = setup();
  const s1 = se.addSignal({ type: 'X', bias: 'bullish', confidence: 80, price: 100, ts: Date.now() });
  const s2 = se.addSignal({ type: 'X', bias: 'bullish', confidence: 80, price: 100.001, ts: Date.now() });
  assert.ok(s1, 'ilk sinyal eklenir');
  assert.equal(s2, null, 'duplike sinyal reddedilir');
  assert.equal(STATE.signals.length, 1);
});

test('farklı fiyattaki sinyal dedup etmez', () => {
  const se = setup();
  se.addSignal({ type: 'X', bias: 'bullish', confidence: 80, price: 100 });
  const s2 = se.addSignal({ type: 'X', bias: 'bullish', confidence: 80, price: 101 });
  assert.ok(s2);
  assert.equal(STATE.signals.length, 2);
});

test('stale veri confidence kırpar (%15)', () => {
  const se = setup();
  STATE.stale = true;
  const s = se.addSignal({ type: 'Y', bias: 'bearish', confidence: 100, price: 100 });
  assert.ok(s.confidence <= 85, `stale iken confidence düşmeli, geldi: ${s.confidence}`);
});

test('decay: eski sinyal düşer', () => {
  const se = setup();
  se.addSignal({ type: 'Z', bias: 'warning', confidence: 90, price: 100, ts: Date.now() - 5000 });
  const before = STATE.signals[0].decay;
  STATE.signals[0].ts = Date.now() - 120000; // 2 dk yaşlandır
  STATE.signals[0].expiresAt = Date.now() + 100000;
  se.applyDecay();
  assert.ok(STATE.signals[0].decay < before, 'decay azalmalı');
});

test('expiry: süresi geçen sinyal temizlenir', () => {
  const se = setup();
  se.addSignal({ type: 'A', bias: 'bullish', confidence: 90, price: 100 });
  STATE.signals[0].expiresAt = Date.now() - 1;
  const removed = se.applyDecay();
  assert.equal(removed, 1);
  assert.equal(STATE.signals.length, 0);
});

test('SMA doğru hesaplanır', () => {
  const out = sma([1, 2, 3, 4, 5], 3);
  assert.equal(out[2], 2);
  assert.equal(out[4], 4);
});

test('EMA son değer aralıkta', () => {
  const out = ema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
  assert.ok(out.at(-1) > 8 && out.at(-1) <= 10);
});

test('RSI: yalnız artış → 100', () => {
  const prices = [];
  for (let i = 1; i <= 30; i++) prices.push(i);
  const out = rsi(prices, 14);
  assert.equal(out.at(-1), 100);
});

test('RSI: yalnız düşüş → 0', () => {
  const prices = [];
  for (let i = 30; i >= 1; i--) prices.push(i);
  const out = rsi(prices, 14);
  assert.equal(out.at(-1), 0);
});

test('ATR pozitif', () => {
  const candles = [];
  for (let i = 0; i < 30; i++) {
    candles.push({ open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i });
  }
  const out = atr(candles, 14);
  assert.ok(out.at(-1) > 0);
});
