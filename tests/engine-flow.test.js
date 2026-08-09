import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlowEngine } from '../src/engines/FlowEngine.js';
import { STATE } from '../src/core/State.js';
import { CONFIG } from '../src/core/Config.js';
import { EventBus } from '../src/core/EventBus.js';

function setup() {
  STATE.flowCandles = [];
  CONFIG.flowMode = 'volume';
  CONFIG.flowVolumeTarget = 1000;
  return new FlowEngine(new EventBus());
}

test('volume modunda bucket hedefe ulaşınca candle oluşur', () => {
  const fe = setup();
  fe.updateBucket({ price: 100, qty: 2, notional: 200, side: 'buy', ts: 1 });
  fe.updateBucket({ price: 100, qty: 2, notional: 200, side: 'buy', ts: 2 });
  fe.updateBucket({ price: 100, qty: 2, notional: 200, side: 'buy', ts: 3 });
  fe.updateBucket({ price: 100, qty: 2, notional: 200, side: 'buy', ts: 4 });
  fe.updateBucket({ price: 100, qty: 2, notional: 200, side: 'buy', ts: 5 }); // 1000 → kapanır
  fe.updateBucket({ price: 100, qty: 1, notional: 100, side: 'sell', ts: 6 });

  assert.equal(STATE.flowCandles.length, 1, '1 candle oluşmalı');
  const c = STATE.flowCandles[0];
  assert.equal(c.buy, 1000);
  assert.equal(c.sell, 0);
  assert.ok(c.pressureClose > 0, 'tamamen buy → pressure pozitif');
  assert.equal(c.strength, 100);
});

test('time modunda süre dolunca candle kapanır', () => {
  STATE.flowCandles = [];
  CONFIG.flowMode = 'time';
  CONFIG.flowTimeframeMs = 1000;
  const fe = new FlowEngine(new EventBus());
  fe.updateBucket({ price: 100, qty: 1, notional: 100, side: 'buy', ts: Date.now() });
  fe.bucket.startTs = Date.now() - 2000; // süreyi geçir
  fe.tick();
  assert.equal(STATE.flowCandles.length, 1);
});

test('karışık akışta pressure yönü doğru', () => {
  const fe = setup();
  fe.updateBucket({ price: 100, qty: 1, notional: 800, side: 'buy', ts: 1 });
  fe.updateBucket({ price: 100, qty: 1, notional: 200, side: 'sell', ts: 2 }); // 1000 → hedef
  fe.updateBucket({ price: 100, qty: 1, notional: 100, side: 'sell', ts: 3 }); // kontrol: kapanır
  const c = STATE.flowCandles[0];
  assert.equal(c.delta, 600, 'kapanan bucket: buy 800 - sell 200');
  assert.ok(c.pressureClose > 0, 'buy ağırlıklı → pozitif pressure');
});
