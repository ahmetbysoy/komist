import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfluenceEngine } from '../src/confluence/ConfluenceEngine.js';
import { PositionManager } from '../src/risk/PositionManager.js';
import { PantheonManager } from '../src/panteon/PantheonManager.js';

function fakeBot() {
  const bot = {
    settings: {
      confluenceThreshold: 3,
      cooldowns: {
        signalMs: 0, sameDirectionMs: 0, oppositeDirectionMs: 0,
        reverseHysteresisPoints: 2, proposalTimeoutMs: 5000, strategyProposalMs: 0
      },
      features: { enableMtfConfirm: false, enableCandleConfirm: false },
      optimization: { timeDecaySec: 3, dirMargin: 0.5, signalQuality: { minContributors: 2, minGroups: 1 }, gating: { enabled: false } }
    },
    strategyStats: {},
    strategies: {},
    currentSymbol: 'BTCUSDT',
    marketData: { price: 100 },
    getEffectiveThreshold: () => 3,
    getStrategyWeight: () => 1.0,
    marketGatingPenalty: () => 0,
    calculateDynamicTpSl: (sig) => {
      sig.tp = sig.price + 5;
      sig.sl = sig.price - 5;
    },
    addPendingSignal: () => {},
    activateSignal: () => {},
    getRecommendedPositionSize: () => null
  };
  return bot;
}

test('ConfluenceEngine: yeterli uyumla sinyal üretir', () => {
  const bot = fakeBot();
  const ce = new ConfluenceEngine(bot);
  let activated = null;
  bot.activateSignal = (sig) => { activated = sig; };

  // 2+ strateji aynı yönde (minContributors=2)
  ce.propose('wallBounce', 'buy', 'wall', 5);
  ce.propose('vwapReversion', 'buy', 'vwap', 4);

  assert.ok(activated, 'sinyal üretilmeli');
  assert.equal(activated.direction, 'buy');
  assert.ok(activated.score >= 3, 'skor eşiği aşmalı');
});

test('ConfluenceEngine: tek katkıcı ile sinyal üretilmez', () => {
  const bot = fakeBot();
  const ce = new ConfluenceEngine(bot);
  let activated = null;
  bot.activateSignal = (sig) => { activated = sig; };

  ce.propose('wallBounce', 'buy', 'wall', 5);

  assert.equal(activated, null, 'minContributors=2 sağlanmıyor');
});

test('ConfluenceEngine: zıt yönler dengelenince sinyal üretilmez (yön marjı)', () => {
  const bot = fakeBot();
  const ce = new ConfluenceEngine(bot);
  let activated = null;
  bot.activateSignal = (sig) => { activated = sig; };

  // 4 proposal'ı önce topla, sonra tek seferde check et
  ce.proposals.push(
    { strategy: 'wallBounce', direction: 'buy', reason: 'w', score: 3, timestamp: Date.now() },
    { strategy: 'vwapReversion', direction: 'buy', reason: 'v', score: 3, timestamp: Date.now() },
    { strategy: 'breakoutPattern', direction: 'sell', reason: 'b', score: 3, timestamp: Date.now() },
    { strategy: 'liquidationCascade', direction: 'sell', reason: 'l', score: 3, timestamp: Date.now() }
  );
  ce._checkConfluence();

  assert.equal(activated, null, 'skorlar eşit, marj aşılmamalı');
});

test('PositionManager: buy sinyali için TP > entry > SL', () => {
  const bot = fakeBot();
  bot.candles = [];
  bot.settings.params = { atrPeriod: 14, rrRatio: 1.5 };
  const pm = new PositionManager(bot);
  const levels = pm.calculateLevels('buy', 100, 5, 'trend');
  assert.ok(levels);
  assert.ok(levels.tp > 100 && levels.sl < 100);
  assert.ok(levels.rr >= 1.5);
});

test('PantheonManager: TP → katkıda bulunan +3, Raphael +1', () => {
  const bot = fakeBot();
  bot.strategyAmbassadors = { wallBounce: { ambassador: 'metatron' } };
  const p = new PantheonManager(bot);
  p.elciler.metatron.reputation = 70;
  p.elciler.raphael.reputation = 70;
  p.elciler.uriel.reputation = 70;

  p.updateReputation({ strategy: 'wallBounce', outcome: 'tp' });
  assert.ok(p.elciler.metatron.reputation > p.elciler.raphael.reputation,
    'TP: Metatron +3, Raphael +1 → Metatron üstte');
  assert.equal(p.elciler.uriel.reputation, 70, "Uriel TP'de artmamalı");
});

test('PantheonManager: SL → tümü -1, katkıda bulunan ekstra -2', () => {
  const bot = fakeBot();
  bot.strategyAmbassadors = { wallBounce: { ambassador: 'metatron' } };
  const p = new PantheonManager(bot);
  p.elciler.metatron.reputation = 50;
  p.elciler.raphael.reputation = 50;
  p.elciler.uriel.reputation = 50;

  p.updateReputation({ strategy: 'wallBounce', outcome: 'sl' });
  assert.ok(p.elciler.metatron.reputation < p.elciler.uriel.reputation,
    'SL: Metatron -1-2=47, Uriel -1=49 → Metatron altta');
});

test('PantheonManager: mod eşikleri', () => {
  const bot = fakeBot();
  const p = new PantheonManager(bot);
  p.elciler.metatron.reputation = 90;  p.updateAllModes();
  assert.equal(p.elciler.metatron.mode, 'İNANÇLI');
  p.elciler.metatron.reputation = 60;  p.updateAllModes();
  assert.equal(p.elciler.metatron.mode, 'ŞÜPHECİ');
  p.elciler.metatron.reputation = 30;  p.updateAllModes();
  assert.equal(p.elciler.metatron.mode, 'KIYAMET');
});
