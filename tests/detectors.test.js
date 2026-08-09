import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WallDetector } from '../src/detectors/WallDetector.js';
import { DetectorSuite } from '../src/detectors/DetectorSuite.js';
import { CompressionDetector } from '../src/detectors/CompressionDetector.js';
import { STATE } from '../src/core/State.js';
import { EventBus } from '../src/core/EventBus.js';

test('wall tespiti: belirgin büyük emir', () => {
  STATE.detectorState.walls = { bid: [], ask: [] };
  STATE.lastPrice = 100;
  // Normal seviyeler + 1 dev bid (qty 5000 → notional 500K > 100K)
  const bids = [];
  for (let i = 0; i < 15; i++) {
    const qty = i === 0 ? 5000 : 1;
    bids.push({ price: 100 - i * 0.1, qty, notional: (100 - i * 0.1) * qty });
  }
  const asks = [];
  for (let i = 0; i < 15; i++) {
    asks.push({ price: 100.1 + i * 0.1, qty: 1, notional: (100.1 + i * 0.1) * 1 });
  }
  STATE.book = { bids, asks, ts: Date.now(), lastUpdateId: 0 };

  let signals = [];
  const bus = new EventBus();
  bus.on('signal:add', (s) => signals.push(s));

  const wd = new WallDetector(bus);
  // Confidence = 55 + persistence×3 + age → 2. taramada eşiği aşar
  wd.detect();
  wd.detect();

  assert.ok(signals.length > 0, 'wall sinyali üretilmeli');
  assert.ok(signals.some((s) => s.type === 'STRONG_BID_WALL'));
});

test('DetectorSuite: tüm dedektörler hata vermeden çalışır', () => {
  STATE.book = { bids: [], asks: [], ts: 0, lastUpdateId: 0 };
  STATE.trades = [];
  STATE.liquidations = [];
  STATE.flowCandles = [];
  STATE.cvdHistory = [{ ts: Date.now(), value: 0 }];
  STATE.detectorState = {
    walls: { bid: [], ask: [] }, compressionActive: false, ladderCount: 0,
    spoofCandidates: [], icebergZones: [], lastSpoofCheck: 0
  };
  const suite = new DetectorSuite(new EventBus());
  // Boş kitapta hata vermemeli
  suite.run();
  assert.ok(true);
});

test('compression: wall yokken aktifleşmez', () => {
  STATE.detectorState.walls = { bid: [], ask: [] };
  STATE.detectorState.compressionActive = false;
  STATE.book = {
    bids: [{ price: 99.9, qty: 1, notional: 99.9 }],
    asks: [{ price: 100.1, qty: 1, notional: 100.1 }],
    ts: 0, lastUpdateId: 0
  };
  const cd = new CompressionDetector(new EventBus());
  cd.detect();
  assert.equal(STATE.detectorState.compressionActive, false);
});
