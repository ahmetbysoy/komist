# ✅ ULTIMATE TRADING KOMUTA MERKEZİ — GÖREV LİSTESİ (v2.0 — barva35 tabanlı)

## FAZ 0 — Plan & İskelet
- [x] PLAN.md yazıldı (barva35 tek referans)
- [x] package.json / vite.config / capacitor.config / index.html
- [x] Klasör ağacı + git init

## FAZ 1 — Çekirdek
- [x] `core/Config.js` — barva35 DEFAULT_SETTINGS
- [x] `core/State.js` — barva35 çalışma zamanı
- [x] `core/Utils.js` — formatPrice/formatVolume/getDecimalPlaces
- [x] `core/Logger.js`

## FAZ 2 — Veri Katmanı
- [x] `data/BinanceStream.js` — 4 stream + exponential backoff
- [x] `data/ExchangeManager.js` — handleMarketData dağıtımı + mock fallback
- [x] `data/MockDataGenerator.js` + `data/ZebaniFilter.js`

## FAZ 3 — Stratejiler & Göstergeler
- [x] `strategies/Strategy.js` — base (propose/cooldown/shadow)
- [x] 20 strateji (barva35 birebir) + registry
- [x] `indicators/` — RSI, ATR, SMA, EMA, BB, ADX, VWAP, SuperTrend

## FAZ 4 — Confluence & Risk & Panteon
- [x] `confluence/ConfluenceEngine.js` — MTF teyidi, gating, cooldown, histerezis
- [x] `confluence/MultiTimeframeManager.js`
- [x] `risk/RiskGuardian.js` (kill switch), `SpoofDetector.js`, `SessionProfiler.js`, `CUSUMDriftDetector.js`, `PositionManager.js` (TP/SL + BE/trailing)
- [x] `panteon/PantheonManager.js` — 3 elçi + itibar + kehanet

## FAZ 5 — Render & UI
- [x] `render/ChartManager.js` (Lightweight Charts npm)
- [x] `render/HeatmapManager.js` (orderbook heatmap)
- [x] `render/EffectsManager.js` (partikül)
- [x] `ui/UIController.js`, `ui/NotificationService.js`, `ui/TtsService.js`
- [x] `styles/app.css` — barva35 tema/layout (dark/light/war + mobil)

## FAZ 6 — Depolama & App
- [x] `storage/DBManager.js` (IndexedDB), `StorageBridge.js`, `Migration.js`
- [x] `app/App.js` — UltimateTradingCommandCenter
- [x] `main.js` + `index.html` (barva35 UI)

## FAZ 7 — Test & Build
- [x] 20 birim test (strategies/confluence/panteon/indicators/utils) — geçti
- [x] Vite build — 62 modül, 71 kB gzip
- [ ] Dev server doğrulaması (canlı preview)
- [ ] CI'da APK üretimi doğrulaması (push sonrası)

## FAZ 8 — Yayın
- [ ] git commit + push (barva35 revizyonu)
- [ ] CI'da APK artifact doğrulama (kullanıcı)
