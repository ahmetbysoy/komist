# ⚡ BOZOK TERMINAL MOBILE

**BOZOK PRO (mikroyapı)** + **Ultimate Trading Komuta Merkezi (strateji/confluence)** teknik dokümanlarından modüler olarak kodlanmış, **Capacitor** ile Android `.apk` üretilen mobil trading analiz terminali.

> ⚠️ Bu uygulama **gerçek trade execution yapmaz.** Sadece analiz + sinyal + paper trading simülasyonu sunar.

## ✨ Özellikler

| Katman | İçerik |
|---|---|
| **Mikroyapı** | Order book (spread/OBI/microprice/slope), CVD + velocity, VPIN, flow candle |
| **9 Dedektör** | Wall, Compression, Spoof, Iceberg, Liquidity Void, Ladder, Book Skew, Flow Pattern, Liquidation Cluster |
| **20 Strateji** | WallBounce, RSI Divergence, SR, VWAP, FundingRate, Velocity, Breakout, BOS, VolBreak, LiqCascade, OrderFlowMomentum, LiquidityGaps, Fibonacci, VolumeProfile, SmartMoney, Divergence, InstitutionalFlow, MicroSpread, SuperTrend, CandleCharacter |
| **Confluence** | Zaman çürümesi, Beta-Binomial Bayes ağırlık, MTF bilgelik, gating, cooldown/histerezis |
| **Panteon** | 5 elçi, itibar, mod çarpanları, Mahşerin 4 Atlısı (Oracle) |
| **Risk** | Araf Protokolü (kill switch), breakeven/trailing, CUSUM drift |
| **UI** | 8 sekme, 4 tema, DPR canvas render, TTS (tr-TR), ses efektleri |

## 📁 Klasör Yapısı

```
src/
├── core/        EventBus, Config, State, Utils, Logger
├── data/        ExchangeManager, BinanceStream, Mock, ZebaniFilter
├── engines/     Microstructure, Trade, Flow, Signal, PaperTrading
├── detectors/   DetectorSuite + 9 dedektör
├── strategies/  Strategy base + 20 strateji + registry
├── confluence/  ConfluenceEngine, BayesianWeighting, MTF
├── indicators/  RSI, ATR, EMA, SMA, BB, ADX, VWAP, SuperTrend
├── risk/        RiskGuardian, PositionManager, CUSUM
├── panteon/     PantheonManager, TheOracle, PantheonEffects
├── render/      RenderEngine + Book/Flow/Chart/CvdEquity renderer
├── ui/          UIController, SignalFeed, TtsService
├── storage/     StorageService, StorageBridge, Migration
└── app/         App.js (orchestrator) + main.js
```

## 🛠 Geliştirme

```bash
npm install          # bağımlılıklar
npm run dev          # Vite dev sunucusu (http://localhost:5173)
npm run build        # dist/ üret
npm test             # birim testler (Node test runner)
```

## 📱 APK Üretimi

### Otomatik (önerilen) — GitHub Actions
`.github/workflows/build-apk.yml` her `main` push'unda APK derler:

1. Repoyu GitHub'a it (`git push origin main`)
2. **Actions** sekmesi → "Build Android APK" workflow'u çalışır
3. Biten işin **Artifacts** kısmından `bozok-terminal-apk` indir
4. `v1.0.0` gibi bir tag atarsan APK otomatik **Release** sayfasına eklenir

```bash
git tag v1.0.0 && git push origin v1.0.0
```

### Yerel (Android Studio / SDK varsa)
```bash
npm run build
npx cap add android    # ilk sefer
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 🔑 Veri Kaynakları

| Veri | Kaynak |
|---|---|
| Order book (100ms diff) | Binance Futures WS `@depth@100ms` |
| Trade'ler | Binance WS `@aggTrade` |
| Likidasyonlar | Binance WS `@forceOrder` |
| 24s değişim | Binance WS `@ticker` |
| Mumlar | Binance REST `/fapi/v1/klines` |
| Çoklu borsa | Bybit / OKX / MEXC REST (3s polling) |
| Fallback | Mock veri üretici (random walk) |

> CORS kısıtı olan ortamlarda (ör. dosya açma) uygulama otomatik **mock moda** geçer. APK içinde WebView `https` şemasıyla çalışır, CORS sorunu olmaz.

## 🏗 Mimari Felsefe

- **EventBus üzerinden loose-coupling**: modüller birbirini tanımaz
- **Tek sorumluluk**: her dosya bir sınıf, her sınıf test edilebilir
- **Formül sadakati**: kaynak dokümanlardaki VPIN, CVD, Kelly, decay, Bayesian formülleri birebir
- **Mobil-first**: alt navigasyon, dokunmatik kontroller, offline-capable

## 📄 Dokümanlar

- [PLAN.md](./PLAN.md) — mimari kararlar ve modül eşlemesi
- [TODO.md](./TODO.md) — görev takibi
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — detaylı mimari
- [docs/API.md](./docs/API.md) — modül API referansı

## 🧩 Teknoloji

JavaScript (ES Modules) • Vite • Capacitor 6 • GitHub Actions • Binance Futures API

---
*Kaynak dokümanlar: BOZOK_PRO_TEKNİK_DOKÜMAN.md, TRADING_TERMINAL_TEKNIK_DOKUMAN v2.0, barva35.html*
