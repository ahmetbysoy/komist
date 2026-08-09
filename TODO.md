# ✅ BOZOK TERMINAL MOBILE — GÖREV LİSTESİ (TODO)

> Kurallar: Her tamamlanan görevin kutusu `[x]` yapılır. Sıra sistematiktir: önce iskelet, sonra çekirdek, sonra motorlar, sonra üst katmanlar.

## FAZ 0 — Kurulum & İskelet
- [x] PLAN.md yazıldı (mimari, teknoloji, klasör yapısı)
- [x] Proje scaffolding: package.json, vite.config, capacitor.config (index.html → FAZ 10)
- [x] Klasör ağacı oluşturuldu (src/ alt modüller)
- [x] git repo init + .gitignore

## FAZ 1 — Çekirdek (core)
- [x] `core/Config.js` — CONFIG sabitleri (BOZOK + UTC merge)
- [x] `core/State.js` — STATE çalışma zamanı
- [x] `core/EventBus.js` — pub/sub
- [x] `core/Utils.js` — clamp/median/mean/rollingSlope/fmt/uid
- [x] `core/Logger.js` — log + journal

## FAZ 2 — Veri Katmanı (data)
- [x] `data/ExchangeManager.js` — Binance WS + REST snapshot + cross-exchange polling
- [x] `data/BinanceStream.js` — combined stream parser + reconnect (exponential backoff)
- [x] `data/MockDataGenerator.js` — mock fallback
- [x] `data/ZebaniFilter.js` — bad tick filtresi (GPTE)

## FAZ 3 — Motorlar (engines)
- [x] `engines/MicrostructureEngine.js` — book snapshot/diff, spread/OBI/microprice/slope
- [x] `engines/TradeEngine.js` — side classification, CVD, VPIN, likidasyonlar
- [x] `engines/FlowEngine.js` — flow candle bucket (time/volume modu)
- [x] `engines/SignalEngine.js` — dedup, decay, narrative, trade plan, Kelly micro optimizer
- [x] `engines/PaperTradingEngine.js` — simüle pozisyon, PnL, R-multiple, equity

## FAZ 4 — Dedektörler (detectors)
- [x] `detectors/DetectorSuite.js` — orkestratör
- [x] `detectors/WallDetector.js`
- [x] `detectors/CompressionDetector.js`
- [x] `detectors/SpoofingDetector.js`
- [x] `detectors/IcebergDetector.js`
- [x] `detectors/LiquidityVoidDetector.js`
- [x] `detectors/LadderDetector.js`
- [x] `detectors/BookSkewDetector.js`
- [x] `detectors/FlowPatternDetector.js`
- [x] `detectors/LiquidationClusterDetector.js`

## FAZ 5 — Göstergeler (indicators)
- [x] `indicators/index.js` + RSI, ATR, EMA, SMA, Bollinger, ADX, VWAP, SuperTrend

## FAZ 6 — Stratejiler (strategies)
- [x] `strategies/Strategy.js` — base (propose, cooldown, stats, shadow)
- [x] 20 strateji: WallBounce, RsiDivergence, SupportResistance, VWAPReversion, FundingRate, Velocity, Breakout, MarketStructure, VolatilityBreakout, LiquidationCascade, OrderFlowMomentum, LiquidityGaps, Fibonacci, VolumeProfile, SmartMoney, Divergence, InstitutionalFlow, MicroSpread, SuperTrend, CandleCharacter
- [x] `strategies/index.js` — registry (elçi atamaları, gruplar)

## FAZ 7 — Confluence, Risk, Panteon
- [x] `confluence/ConfluenceEngine.js` — decay, gating, cooldown, histerezis, yön marjı
- [x] `confluence/BayesianWeighting.js` — Beta-Binomial ağırlık + oto-toggle
- [x] `confluence/MultiTimeframeManager.js` — MTF bilgelik faktörü
- [x] `risk/RiskGuardian.js` — Araf Protokolü (kill switch)
- [x] `risk/PositionManager.js` — breakeven, trailing stop
- [x] `risk/CUSUMDriftDetector.js`
- [x] `panteon/PantheonManager.js` — elçiler, itibar, mod çarpanları, fısıltı
- [x] `panteon/TheOracle.js` — Mahşerin 4 Atlısı
- [x] `panteon/PantheonEffects.js` — görsel/ses efektleri

## FAZ 8 — Render & UI
- [x] `render/RenderEngine.js` — DPR canvas orkestratör
- [x] `render/BookRenderer.js` — derinlik + VPVR heatmap + wall marker
- [x] `render/FlowRenderer.js` — flow candle
- [x] `render/ChartRenderer.js` — fiyat chart (mum + indikatör)
- [x] `render/CvdEquityRenderer.js` — CVD + equity grafikleri
- [x] `ui/UIController.js` — sekmeler, katmanlar, formlar, badge
- [x] `ui/SignalFeed.js` — sinyal listesi render
- [x] `ui/TtsService.js` — Web Speech (tr-TR) + Web Audio uyarılar
- [x] `styles/` — tema CSS (professional/neon/minimal/war) + mobil-first layout

## FAZ 9 — Depolama
- [x] `storage/StorageService.js` — localStorage wrapper
- [x] `storage/StorageBridge.js` — write-through cache (Map + IndexedDB)
- [x] `storage/Migration.js` — legacy → IndexedDB migrasyon

## FAZ 10 — Uygulama & Bootstrap
- [x] `app/App.js` — UltimateTerminal orchestrator (start/stop, loop, timer'lar)
- [x] `src/main.js` — bootstrap + DOMContentLoaded
- [x] `index.html` — mobil-first SPA kabuk

## FAZ 11 — APK & CI
- [x] `.github/workflows/build-apk.yml` — otomatik APK (push + tag)
- [x] `capacitor.config.json` + android platform kaydı
- [x] README.md — kurulum, geliştirme, APK yükleme talimatı
- [x] docs/ARCHITECTURE.md + docs/API.md

## FAZ 12 — Test & Doğrulama
- [x] Node smoke test (modül import, engine birim testleri) — 40/40 geçti
- [x] Vite dev server çalıştırma doğrulaması (live preview) — 5173 canlı
- [x] Build testi (`npm run build`) — 78 modül, 29.87 kB gzip
- [ ] TODO kapatma + son kontrol

## FAZ 13 — GitHub Yükleme
- [ ] git add/commit (anlamlı commit mesajları)
- [ ] GitHub repo oluşturma & push talimatı (token kullanıcıda)
- [ ] CI'da APK üretiminin doğrulanması (kullanıcı tarafında)
