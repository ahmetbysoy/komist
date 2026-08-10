import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Strategy } from '../src/strategies/Strategy.js';
import { WallBounceStrategy } from '../src/strategies/WallBounceStrategy.js';
import { CUSUMDriftDetector } from '../src/risk/CUSUMDriftDetector.js';
import { rsi } from '../src/indicators/RSI.js';
import { atr } from '../src/indicators/ATR.js';
import { sma } from '../src/indicators/SMA.js';
import { ema } from '../src/indicators/EMA.js';
import { bollinger } from '../src/indicators/Bollinger.js';

function fakeBot() {
  const bot = {
    marketData: { price: 100, symbol: 'BTCUSDT', btcPrice: 70000 },
    strategyStats: {},
    settings: { features: {}, optimization: { enabled: true } },
    riskGuardian: { killSwitchActivated: false },
    confluenceEngine: { propose: () => {} },
    saveStrategyStats: () => {},
    recordShadowProposal: () => {},
    strategyAmbassadors: { wallBounce: { ambassador: 'metatron' } },
    strategies: {}
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
    bids: [{ price: 100, qty: 30 }],
    asks: [{ price: 100.5, qty: 0.1 }]
  });
  assert.equal(dir, 'buy');
});

test('CUSUM: ardışık kayıp → kötü drift; kazanç → yok', () => {
  const c1 = new CUSUMDriftDetector();
  let alarm = false;
  for (let i = 0; i < 10; i++) if (c1.update(false)) alarm = true;
  assert.equal(alarm, true);

  const c2 = new CUSUMDriftDetector();
  let alarm2 = false;
  for (let i = 0; i < 10; i++) if (c2.update(true)) alarm2 = true;
  assert.equal(alarm2, false);
});

test('RSI: yalnız artış → 100, yalnız düşüş → 0', () => {
  const up = []; for (let i = 1; i <= 30; i++) up.push(i);
  assert.equal(rsi(up, 14).at(-1), 100);
  const down = []; for (let i = 30; i >= 1; i--) down.push(i);
  assert.equal(rsi(down, 14).at(-1), 0);
});

test('ATR pozitif', () => {
  const candles = [];
  for (let i = 0; i < 30; i++) candles.push({ open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i });
  assert.ok(atr(candles, 14).at(-1) > 0);
});

test('SMA / EMA aralıkta', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(sma(v, 3)[2], 2);
  const e = ema(v, 3);
  assert.ok(e.at(-1) > 8 && e.at(-1) <= 10);
});

test('Bollinger: upper ≥ middle ≥ lower', () => {
  const v = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  const bb = bollinger(v, 20);
  const i = bb.upper.length - 1;
  assert.ok(bb.upper[i] >= bb.middle[i] && bb.middle[i] >= bb.lower[i]);
});
