import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TradeEngine } from '../src/engines/TradeEngine.js';
import { STATE } from '../src/core/State.js';
import { EventBus } from '../src/core/EventBus.js';

function freshState() {
  STATE.trades = [];
  STATE.cvd = 0;
  STATE.cvdHistory = [];
  STATE.liquidations = [];
  STATE.vpin = { value: 0, label: 'Düşük', buckets: [], currentBuy: 0, currentSell: 0, currentNotional: 0, bucketSize: 500000 };
  STATE.book = { bids: [{ price: 100, qty: 1, notional: 100 }], asks: [{ price: 101, qty: 1, notional: 101 }], ts: 0, lastUpdateId: 0 };
}

test('CVD: buy +, sell -', () => {
  freshState();
  const te = new TradeEngine(new EventBus());
  te.addTrade({ price: 100, qty: 2, side: 'buy', ts: 1 });
  assert.equal(STATE.cvd, 200);
  te.addTrade({ price: 100, qty: 1, side: 'sell', ts: 2 });
  assert.equal(STATE.cvd, 100);
});

test('side sınıflandırma: fiyat ≥ mid → buy', () => {
  freshState();
  const te = new TradeEngine(new EventBus());
  assert.equal(te.classifySide({ price: 101, qty: 1 }), 'buy');
  assert.equal(te.classifySide({ price: 100, qty: 1 }), 'sell');
});

test('VPIN: tek yönlü akış yüksek VPIN üretir', () => {
  freshState();
  const te = new TradeEngine(new EventBus());
  // 20 trade tamamen buy — VPIN sample 1.0'a yakın olmalı
  for (let i = 0; i < 20; i++) {
    te.addTrade({ price: 100, qty: 1000, side: 'buy', ts: i });
  }
  // Bucket kapanınca sample = |buy-sell|/total ≈ 1
  const total = STATE.vpin.buckets.reduce((a, b) => a + b, 0);
  assert.ok(STATE.vpin.buckets.length > 0, 'en az bir bucket kapanmalı');
  assert.ok(STATE.vpin.value > 0.9, `tek yönlü akışta VPIN yüksek olmalı, geldi: ${STATE.vpin.value}`);
});

test('likidasyon ekleme', () => {
  freshState();
  const te = new TradeEngine(new EventBus());
  te.addLiquidation({ side: 'SELL', price: 100, qty: 5, ts: 1 });
  assert.equal(STATE.liquidations.length, 1);
  assert.equal(STATE.liquidations[0].notional, 500);
});
