# 🏗 ULTIMATE TRADING KOMUTA MERKEZİ — Mimari

## 1. Veri Akışı

```
Binance Futures WS (4 combined stream)
  @ticker      → marketData (fiyat/24s/hacim) + manageOpenPositions + checkAutoCloseSignals
  @depth20@100ms → orderBook → heatmap.draw + spoofDetector + 20 strateji.analyzeOrderBook
  @kline_{tf}  → candles + chart.updateRealtime; kapanışta: checkPendingSignals + indikatörler
  @aggTrade    → 20 strateji.processTrade

REST: /fapi/v1/klines (500 mum + MTF 5m/15m/1h/4h)

Strateji → ConfluenceEngine.propose
  decay = e^(-ageSec/3) × Bayes ağırlığı × skor
  MTF: trend 'down' → buyScore×0.6
  gating cezası (spread>0.1% / derinlik<$50K / slippage)
  eşik (ayar + panteon mod delta) + yön marjı + cooldown + histerezis
  → generateFinalSignal → pending (mum onayı) → activateSignal

activateSignal → marker + bildirim + TTS + efekt + dinamik boyut
TP/SL takibi → checkAutoCloseSignals (BE 0.8R, trailing 1.5R→0.5R)
Sonuç → Panteon itibar + Bayes α/β + CUSUM + kill switch kontrolü
```

## 2. Modül Bağımlılıkları

```
App.js (UltimateTradingCommandCenter)
 ├─ strategies (20) → ConfluenceEngine → App.activateSignal
 ├─ risk: RiskGuardian / SpoofDetector / SessionProfiler / CUSUM / PositionManager
 ├─ panteon: PantheonManager (3 elçi)
 ├─ render: ChartManager / HeatmapManager / EffectsManager
 ├─ ui: UIController / NotificationService / TtsService
 ├─ data: ExchangeManager (BinanceStream + Mock)
 └─ storage: DBManager → StorageBridge → Migration
```

## 3. Döngüler

| Döngü | Periyot | Görev |
|---|---|---|
| render | 500ms | ticker, sinyal barları, kehanet paneli |
| analysis | 5s | strateji periodicAnalyze + oto-toggle + panteon durgunluk |
| session | 60s | seans tespiti |
| countdown | 1s | mum kapanış sayacı |
| performance | 60s | oto-optimizasyon |

## 4. Kaynak Eşleme

Tek referans: **barva35.html** — tüm sınıf/metot/formül birebir taşındı.
Detay: [PLAN.md §3](../PLAN.md)
