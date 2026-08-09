# 🏗 BOZOK TERMINAL MOBILE — Mimari Dokümanı

## 1. Veri Akışı

```
Binance WS (4 stream) ──► ExchangeManager
  ├─ @depth@100ms ─► MicrostructureEngine.applyDiff ─► book:update
  │                     └─ recompute() ─► micro:update (spread/OBI/microprice/slope)
  │                     └─ DetectorSuite.run() ─► 9 dedektör ─► signal:add
  │                     └─ Strategy.analyzeOrderBook (20 strateji)
  │                     └─ FlowEngine.tick + PaperTrading.update
  ├─ @aggTrade ────► TradeEngine.addTrade ─► CVD + VPIN ─► trade:update
  │                     └─ FlowEngine.updateBucket ─► flow:update
  │                     └─ Strategy.processTrade
  ├─ @ticker ──────► STATE.priceChange24h
  └─ @forceOrder ──► TradeEngine.addLiquidation ─► liquidation:update

REST:
  /fapi/v1/depth   → snapshot (bağlantı öncesi)
  /fapi/v1/klines  → mum geçmişi (1m, 200 mum)
  /fapi/v1/premiumIndex → funding rate stratejisi
  Bybit/OKX/MEXC   → 3s polling → exchanges:update

Sinyal zinciri:
  detector/strateji → signal:add → SignalEngine.addSignal
    → dedup + confidence haircut → signal:updated (UI)
    → updateNarrative → narrative:update
    → generateTradePlan → plan:update (entry/SL/TP1/TP2, RR≥2.5)
    → calculateMicroOptimizer → microoptimizer:update (Kelly)
    → PaperTradingEngine.simulateFromPlan → paper:open

Confluence zinciri (UTC):
  Strategy.propose → ConfluenceEngine.propose
    → zaman çürümesi e^(-age/3) × Bayes ağırlığı × skor
    → gating (spread≤0.1%, depth≥$50K), cooldown, histerezis, yön marjı
    → onConfluenceSignal → signal + plan + paper trade
```

## 2. Modül Bağımlılık Diyagramı

```
                    ┌──────────────┐
                    │  App.js      │ (orchestrator, tümünü kurar)
                    └──┬────┬───┬──┘
           EventBus ◄───┘    │   └────────────► RenderEngine ─► renderer'lar
              ▲             │
              │        ┌────▼─────┐
  engines ◄───┼────────┤ Exchange │──► BinanceStream / Mock / Zebani
  detectors ──┼────────► Manager  │
  strategies ─┼────────► (data)   │
              │        └──────────┘
  confluence ──┘
  (ConfluenceEngine ← BayesianWeighting ← MultiTimeframeManager)
  (RiskGuardian / PositionManager / CUSUM)
  (PantheonManager ← TheOracle ← PantheonEffects)
  (StorageService ← StorageBridge ← Migration)
```

## 3. Önemli Tasarım Kararları

| Karar | Gerekçe |
|---|---|
| **Vanilla JS ES Modules** | Kaynak kodlar saf JS sınıfları; framework dayatmadan birebir taşıma |
| **Vite bundler** | ES module → tek bundle; Capacitor webDir uyumlu; dev server |
| **Capacitor (native kabuk)** | Aynı kod tabanından gerçek `.apk`; Android SDK gerekmez (CI üretir) |
| **CDN'siz chart** | Mobil offline çalışma; Lightweight Charts yerine özel canvas çizimi |
| **Mock fallback** | CORS/ağ hatasında terminal asla boş kalmaz (BOZOK §11) |
| **IndexedDB + localStorage** | Write-through cache (StorageBridge) ile senkron O(1) okuma |

## 4. Döngüler

| Döngü | Periyot | Görev |
|---|---|---|
| rAF | ~16ms | RenderEngine.renderAll (100ms throttle) |
| Timer | 250ms | flow.tick, paper.update |
| Timer | 1s | stale kontrol, UI durum |
| Timer | 5s | sinyal decay/expiry, strateji periodicAnalyze, Oracle, oto-toggle, kill switch |
| Timer | 60s | Panteon durgunluk, kline tazeleme |

## 5. Kaynak Eşleme Tablosu

Detaylı eşleme için [PLAN.md §4](./../PLAN.md) bölümüne bakın. Özet:

- BOZOK §2-15 → `core/`, `engines/`, `detectors/`, `render/`, `data/`, `ui/`, `storage/`
- UTC §4-20 → `strategies/`, `confluence/`, `risk/`, `panteon/`, `indicators/`
