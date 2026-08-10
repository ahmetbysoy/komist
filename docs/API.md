# 🔌 KOMUTA MERKEZİ — Modül API Özeti (barva35)

## App.js (UltimateTradingCommandCenter)
| Metod | Açıklama |
|---|---|
| `init()` | DB + storage + UI + döngüler |
| `start()` / `stop()` | WS bağlantısı + zamanlayıcılar |
| `handleMarketData(type, data)` | WS dağıtımı (ticker/depth/kline/aggTrade) |
| `calculateAllIndicators()` | RSI/ATR/SMA/VWAP/ADX/BB + rejim |
| `getStrategyWeight(name)` | Beta-Binomial Bayes ağırlığı |
| `getGroupBoost(key)` | Rejim × grup boost |
| `getEffectiveThreshold()` | Eşik + panteon mod delta |
| `marketGatingPenalty()` | Spread/derinlik/slippage cezası |
| `calculateDynamicTpSl(signal)` | ATR bazlı TP/SL |
| `addPendingSignal` / `checkPendingSignals` | Mum onayı |
| `activateSignal(signal)` | Marker + bildirim + TTS + efekt |
| `checkAutoCloseSignals()` | TP/SL + BE + trailing |
| `updateSignalResult(signal)` | Panteon + istatistik + CUSUM |
| `getRecommendedPositionSize(score)` | Dinamik boyut (0.5x–2.0x) |
| `changeSymbol` / `changeTimeframe` / `toggleTheme` | Kontroller |

## ConfluenceEngine
| Metod | Açıklama |
|---|---|
| `propose(strategy, dir, reason, score)` | Öneri kabul + check |
| `_computeDirectional(dir)` | Decay × ağırlık × skor |
| `_checkConfluence()` | Tüm kurallar + generateFinalSignal |
| `generateFinalSignal(dir, contributors, score)` | pending/aktif sinyal üret |

## PantheonManager
| Metod | Açıklama |
|---|---|
| `updateReputation(result)` | TP: +3/+1, SL: -1/-2 |
| `updateAllModes()` | İNANÇLI/ŞÜPHECİ/KIYAMET |
| `applyProphecy(p)` | DEFENSIVE/AGGRESSIVE/NEUTRAL |
| `checkInactivity()` | 4 saat → -1 |
| `getThresholdDelta()` | Mod bazlı eşik ayarı |

## RiskGuardian / PositionManager / SpoofDetector
| Metod | Açıklama |
|---|---|
| `checkKillSwitch()` | WR < %35 → stop |
| `calculateLevels(dir, price, score, regime)` | TP/SL/RR |
| `manageOpenPositions()` | BE + trailing |
| `trackOrderBook(book)` | 15s kaybolan büyük emir → spoof |
