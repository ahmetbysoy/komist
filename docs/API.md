# 🔌 BOZOK TERMINAL MOBILE — API Referansı

## EventBus Olayları

| Event | Yayıcı | Veri | Dinleyiciler |
|---|---|---|---|
| `book:update` | MicrostructureEngine | STATE.book | DetectorSuite, stratejiler, Flow, Paper, Ladder UI |
| `micro:update` | MicrostructureEngine | STATE.micro | UI metrikleri |
| `trade:update` | TradeEngine | Trade objesi | FlowEngine, stratejiler, candle builder |
| `liquidation:update` | TradeEngine | Liq objesi | UI |
| `vpin:update` | TradeEngine | STATE.vpin | UI |
| `flow:update` | FlowEngine | FlowCandle | UI |
| `signal:add` | DetectorSuite / App | Signal objesi | SignalEngine |
| `signal:updated` | SignalEngine | Signal objesi | UIController, SignalFeed |
| `narrative:update` | SignalEngine | String | UI |
| `plan:update` | SignalEngine | TradePlan | UI, PaperTrading |
| `microoptimizer:update` | SignalEngine | MicroOptimizer | UI |
| `paper:open` / `paper:close` | PaperTradingEngine | Position / CloseInfo | UI, Panteon, Bayes, CUSUM |
| `exchanges:update` | ExchangeManager | STATE.exchanges | UI |
| `connection:update` | ExchangeManager | {status, connected} | UI |
| `horseman:change` | App (Oracle) | 'SAVAŞ'\|'KITLIK'\|'SALGIN'\|'ÖLÜM'\|null | UI |

## Motorlar

### MicrostructureEngine
| Metod | Açıklama |
|---|---|
| `applySnapshot(symbol, snapshot)` | REST depth'i uygula |
| `applyDiff(diff)` | WS diff uygula (out-of-order koruması) |
| `recompute()` | spread/OBI/microprice/slope hesapla |
| `spreadBps()` | Normalize spread (bps) |

### TradeEngine
| Metod | Açıklama |
|---|---|
| `classifySide(trade)` | side tayini (m ya da mid) |
| `addTrade(trade)` | Trade ekle + CVD + VPIN |
| `cvdVelocity()` | 10s CVD değişimi |
| `updateVPIN(trade)` | VPIN bucket sistemi |
| `addLiquidation(liq)` | Likidasyon kaydet |

### SignalEngine
| Metod | Açıklama |
|---|---|
| `addSignal(sig)` | Dedup + haircut + narrative + plan |
| `scoreSignals()` | 30s confidence×decay scoring |
| `generateTradePlan()` | entry/SL/TP + RR kontrolü |
| `calculateMicroOptimizer()` | Kelly sizing + liq price |
| `applyDecay()` | decay/expiry temizliği |

### PaperTradingEngine
| Metod | Açıklama |
|---|---|
| `simulateFromPlan(plan)` | Slippage ile pozisyon aç (30s cooldown) |
| `update()` | Stop/TP/breakeven/trailing kontrolü |
| `close(pos, price, reason)` | PnL + R + equity güncelle |

## Dedektörler (DetectorSuite)
`run()` — her book:update'te; `onTrade()` — trade'de.
Sıra: wall → compression → skew → void → ladder → spoof → iceberg → (4 tick'te bir) flowPattern → liqCluster

## Stratejiler
Tümü `Strategy`'den türer. Hook'lar:
- `analyzeOrderBook(orderBook)` — depth güncellemesi
- `processTrade(trade)` — her trade
- `periodicAnalyze()` — 5s

`propose(symbol, dir, reason, score)` — cooldown + kill switch + confluence.

## Confluence
| Metod | Açıklama |
|---|---|
| `propose(strategy, dir, reason, score, ambassador)` | Proposal kabul |
| `getStrategyWeight(strategy)` | Bayes ağırlığı |
| `_checkConfluence()` | Tüm kuralları uygula |

## Panteon
| Metod | Açıklama |
|---|---|
| `onSignalResult(result)` | İtibar güncelle |
| `getMode(name)` / `getRRMultiplier()` / `getCooldownScale()` | Mod çarpanları |
| `applyProphecy(prophecy)` | Fısıltı |
| `checkInactivity()` | Durgunluk cezası |

## App (UltimateTerminal)
| Metod | Açıklama |
|---|---|
| `start()` / `stop()` | Yaşam döngüsü |
| `changeSymbol(symbol)` | Sembol değiştir |
| `onConfluenceSignal(...)` | Confluence sinyali → plan + paper |
| `onHorsemanChange(h)` | Atlı değişimi |
| `setTheme(theme)` | Tema uygula |
| `saveSettings()` / `_loadSettings()` | Kalıcılık |
| `getEffectiveThreshold()` | Panteon+Oracle ayarlı eşik |
