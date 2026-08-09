import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Strategy } from '../src/strategies/Strategy.js';
import { WallBounceStrategy } from '../src/strategies/WallBounceStrategy.js';
import { CUSUMDriftDetector } from '../src/risk/CUSUMDriftDetector.js';
import { BayesianWeighting } from '../src/confluence/BayesianWeighting.js';
import { STATE } from '../src/core/State.js';

function fakeBot() {
  const bot = {
    marketData: { price: 100, symbol: 'BTCUSDT', btcPrice: 70000 },
    strategyStats: {},
    settings: { features: {}, optimization: { enabled: true, autoToggle: true, minWeightToStay: 0.6, minContribForToggle: 30 } },
    riskGuardian: { killSwitchActivated: false },
    confluenceEngine: { propose: () => {} },
    saveStrategyStats: () => {},
    recordShadowProposal: () => {}
  };
  return bot;
}

test('Strategy propose: cooldown içinde ikinci öneri engellenir', () => {
  const bot = fakeBot();
  const s = new Strategy(bot, 'testStrategy');
  let count = 0;
  bot.confluenceEngine = { propose: () => count++ };
  s.propose('BTCUSDT', 'buy', 'r1', 3);
  s.propose('BTCUSDT', 'buy', 'r2', 3);
  assert.equal(count, 1, 'cooldown içinde ikinci öneri geçmemeli');
});

test('Strategy shadow modda confluence\'a gitmez', () => {
  const bot = fakeBot();
  const s = new Strategy(bot, 'shadowTest');
  let count = 0;
  bot.confluenceEngine = { propose: () => count++ };
  s.setIsLive(false);
  s.propose('BTCUSDT', 'buy', 'r', 3);
  assert.equal(count, 0);
});

test('WallBounceStrategy: fiyat wall yakınında öneri üretir', () => {
  const bot = fakeBot();
  const s = new WallBounceStrategy(bot);
  let dir = null;
  bot.confluenceEngine = { propose: (n, d) => { dir = d; } };
  s.analyzeOrderBook({
    bids: [{ price: 100, qty: 30, btcValue: 30 }],   // 30 BTC wall
    asks: [{ price: 100.5, qty: 0.1 }]
  });
  assert.equal(dir, 'buy');
});

test('CUSUM: 4 ardışık kayıp → kötü drift', () => {
  const c = new CUSUMDriftDetector();
  let alarm = false;
  for (let i = 0; i < 10; i++) {
    if (c.update(false)) alarm = true;
  }
  assert.equal(alarm, true);
});

test('CUSUM: ardışık kazanç kötü drift üretmez', () => {
  const c = new CUSUMDriftDetector();
  let alarm = false;
  for (let i = 0; i < 10; i++) {
    if (c.update(true)) alarm = true;
  }
  assert.equal(alarm, false);
});

test('BayesianWeighting: prior ağırlık (α=3, β=2, obs=5)', async () => {
  STATE.strategyStats = {};
  const bot = { strategyStats: STATE.strategyStats, saveStrategyStats: () => {}, settings: {} };
  const bw = new BayesianWeighting(bot);
  const w = bw.getWeight('wallBounce');
  // mean=3/5=0.6, penalty=0.5+5/20=0.75 → (1.1)×0.75 = 0.825
  assert.ok(Math.abs(w - 0.825) < 1e-9, `beklenen 0.825, geldi: ${w}`);
});

test('BayesianWeighting: TP sonrası ağırlık artar', async () => {
  STATE.strategyStats = {};
  const bot = { strategyStats: STATE.strategyStats, saveStrategyStats: () => {} };
  const bw = new BayesianWeighting(bot);
  const w0 = bw.getWeight('wallBounce');
  bw.recordResult('wallBounce', true);
  const w1 = bw.getWeight('wallBounce');
  assert.ok(w1 > w0, `TP sonrası ağırlık artmalı: ${w0} → ${w1}`);
});
