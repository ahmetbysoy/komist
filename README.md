# 🏛️ KOMİST — ULTIMATE TRADING KOMUTA MERKEZİ (BOZOK TERMINAL MOBILE)

> **Barva35.html** referansından modülerleştirilmiş, **Capacitor 6 + Vite** ile Android APK üreten Binance Futures sinyal terminali.  
> ⚠️ **Gerçek trade execution YAPMAZ** — sadece sinyal üretir, TP/SL takibi yapar, önerir ve istatistik tutar.

[![Build APK](https://github.com/ahmetbysoy/komist/actions/workflows/build-apk.yml/badge.svg)](https://github.com/ahmetbysoy/komist/actions/workflows/build-apk.yml)
[![Vite Build](https://img.shields.io/badge/vite-5.4-blue)](https://vitejs.dev)
[![Tests](https://img.shields.io/badge/tests-21%2F21-success)](tests/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

**v2.1-patched — 10 Ağustos 2026 — 12 kritik bug fix + 6 entegrasyon patch uygulandı (build 62 modül, 71.9kB gzip, 21/21 test ✅)**

---

## 📋 İçindekiler

- [Ne İşe Yarar?](#-ne-işe-yarar)
- [Kritik Düzeltmeler (Faz A)](#-kritik-düzeltmeler-faz-a--12-bug-fix)
- [Entegrasyon İyileştirmeleri (Faz B)](#-entegrasyon-iyileştirmeleri-faz-b)
- [Mimari](#-mimari)
- [Klasör Yapısı](#-klasör-yapısı)
- [Kurulum & Geliştirme](#-kurulum--geliştirme)
- [APK Üretimi](#-apk-üretimi)
- [Veri Kaynakları](#-veri-kaynakları-binance-futures)
- [Stratejiler & Göstergeler](#-stratejiler--göstergeler)
- [Test](#-test)
- [Yol Haritası](#-yol-haritası)

---

## 🔍 Ne İşe Yarar?

Tek bir mobil terminalde aynı anda **20 teknik strateji** çalışır, **Confluence Engine** bunları zaman çürümesi + Bayes ağırlık + MTF teyidi + gating ile birleştirir, **Panteon (Mitolojik İtibar Sistemi)** ve **Risk Katmanı (Araf Protokolü)** süzgecinden geçirip **pending → aktif → TP/SL** yaşam döngüsüyle kullanıcıya sunar.

```
Binance Dual WS (public:depth / market:ticker/kline/aggTrade) → ExchangeManager → UltimateTradingCommandCenter
  → 20 Strateji.propose() → ConfluenceEngine → generateFinalSignal (pending/aktif)
    → PositionManager.calculateLevels (ATRxRR) → checkAutoCloseSignals
      → Panteon itibar + Bayes stats + CUSUM + RiskGuardian (kill-switch)
```

*   **Grafik:** `lightweight-charts` v3.8 (npm, offline), mum+BB+TP▲/SL▼ marker, zoom/fullscreen
*   **Heatmap:** OrderBook canlı ısı haritası (`HeatmapManager`)
*   **Ses & Efekt:** Türkçe TTS kuyruğu + partikül (`EffectsManager`)
*   **UI:** Sinyal barları (METATRON GÜVENİ / URIEL CESARETİ), kehanet paneli (🛡️⚖️⚔️), 3 tema (dark/light/war)

---

## 🐛 Kritik Düzeltmeler — Faz A (12 Bug Fix)

> Kaynak: `github.com/ahmetbysoy/komist` kod okunarak grep ile doğrulandı — hepsi izole patch ile çözüldü, dosya baştan yazılmadı.

| # | Sorun | Çözüm | Dosya |
|---|-------|-------|-------|
| 1 | **Kill switch hiç tetiklenmiyor** — `RiskGuardian` `STATE.stats` okuyor ama `App` sadece `this.stats` yazıyordu (`total` hep 0) | `updateSignalResult` + `init` içinde `STATE.stats = {...this.stats}` senkronizasyonu eklendi | `src/app/App.js`, `src/risk/RiskGuardian.js` |
| 2 | **`positions` ölü kod** — `this.positions=[]` hiç push edilmiyor, `PositionManager.manageOpenPositions()` no-op | `positions` dizisi kaldırıldı, `manageOpenPositions()` deprecated/no-op yapıldı, TP/SL takibi tek kaynak `signals` + `checkAutoCloseSignals` | `src/app/App.js`, `src/risk/PositionManager.js`, `src/core/State.js` |
| 3 | **ZebaniFilter kopuk** — `check()` hiç çağrılmıyor | `_applyTicker` başına `if (!zebani.check(price)) return;` bağlandı, bad-tick artık filtreleniyor | `src/app/App.js` |
| 4 | **`measureSlippage` yok** — `App` optional chaining ile sessizce yutuyor, `slippageHighUntil` hep 0 | `ConfluenceEngine.measureSlippage(entryPrice)` eklendi: `|current-entry|/entry >0.001` ise 30sn gating cezası | `src/confluence/ConfluenceEngine.js` |
| 5 | **`contrib` hiç artmıyor** — oto shadow-ban ve rejim ağırlığı hiç devreye girmiyor | `updateSignalResult` içinde `target.contrib++` + `overall.contrib++` eklendi, shadow istatistikleri de güncelleniyor | `src/app/App.js` |
| 6 | **5 elçi tanımlı, panteonda 3** — `gabriel/michael`'a bağlı 4 strateji itibara işlemiyor | `PantheonManager.ELCI_NAMES` → 5 elçi (`metatron,uriel,raphael,gabriel,michael`), `elciler` nesnesine eklendi | `src/panteon/PantheonManager.js`, `src/strategies/index.js` |
| 7 | **Ayarlar kalıcılığı çelişkili** — `_loadSettings` localStorage, `saveSettings` IndexedDB | `_loadSettings` StorageBridge üzerinden tekilleştirildi, `init()` içinde storage ready sonrası yükleme, `Migration` artık localStorage'ı temizliyor | `src/app/App.js`, `src/storage/Migration.js`, `src/storage/StorageBridge.js` |
| 8 | **Sembol/timeframe constructor'da erken okunuyor** — `getJsonSync` ready=false iken hep null | Constructor'da DEFAULT kullan, gerçek değer `async init()` içinde `storage.getJsonSync` ile yükleniyor (`STATE` de senkron) | `src/app/App.js` |
| 9 | **Ölü dosyalar** — `ChartRenderer.js` / `RenderEngine.js` hiç import edilmiyor (207 satır yetim) | **Silindi** | `src/render/` |
| 10 | **SpoofDetector oto-optimizasyon ölü** — `autoOptimizeThreshold()` hiç çağrılmıyor | `runPeriodicAnalysis` içinde periyodik çağrı + `rejectRatio` gerçekten hesaplanıyor (`spoofCount/totalTracked`) | `src/risk/SpoofDetector.js`, `src/app/App.js` |
| 11 | **Spoof/CUSUM/Session sadece bildirim** — karar mekanizmasına girmiyor | Gating'e spoof cezası, CUSUM drill → threshold offset + otoToggle, Session → `getGroupBoost` eklendi (detay Faz B) | `src/app/App.js`, `src/risk/*` |
| 12 | **Panteon `getCooldownScale()/getRRMultiplier()` hiç çağrılmıyor** | `ConfluenceEngine._checkConfluence` cooldown'ları `*scale`, `PositionManager.calculateLevels` RR'a `*rrMultiplier` uyguluyor | `src/confluence/ConfluenceEngine.js`, `src/risk/PositionManager.js` |

---

## 🔗 Entegrasyon İyileştirmeleri — Faz B

Modüller artık birbirini besliyor (önceden "bağlı görünüyor ama değil"di):

1.  **Spoof → Confluence:** `marketGatingPenalty(direction)` içinde `lastSpoofTime` <30sn ise +1.0 ceza, yön bağımlı +0.5 (bid spoof → buy cezası, ask spoof → sell cezası)
2.  **CUSUM → Risk:** Kötü drift tespitinde `runtimeThresholdOffset +=0.15` (max 1.5) + `autoToggleStrategies()` otomatik tetikleniyor
3.  **Session → Strateji:** `getGroupBoost` içinde `ASYA` → meanReversion ×1.08 / trending ×0.96, `NEW YORK` → trending ×1.08, `LONDRA` → trending ×1.05
4.  **Zebani → Veri:** Tüm ticker akışı merkezi filtre
5.  **Panteon Mod → Risk/Confluence/RR:** `INANÇLI` cooldown ×0.92 RR ×1.05, `KIYAMET` cooldown ×1.12 RR ×0.95 — confluence eşiği + cooldown + RR üçüne de etki ediyor
6.  **MTF + Panteon:** (ileri) MTF 4/4 aynı yön → AGGRESSIVE kehanet önerisi için altyapı hazır

---

## 🏗️ Mimari

**Tek kaynak:** `barva35.html` → `UltimateTradingCommandCenter` (`src/app/App.js`)

```mermaid
BinanceStream (4 WS) ──► ExchangeManager ──► App.handleMarketData
  ├─ ticker  → ZebaniFilter → marketData + checkAutoCloseSignals
  ├─ depth   → orderBook + Heatmap + SpoofDetector + strategy.analyzeOrderBook
  ├─ kline   → candles + ChartManager + closedCandle → pending onay + indicators
  └─ aggTrade→ strategy.processTrade

Strategy.propose() → ConfluenceEngine.propose()
  → _computeDirectional (e^(-age/3) + Bayes w + groupBoost[rejim+session])
  → gatingPenalty(spread/depth/slippage+spoof) + MTF×0.6
  → threshold+margin+cooldown*hysteresis → generateFinalSignal → pending/active
    → activateSignal → marker+notify+TTS+effect + 2sn sonra measureSlippage
      → checkAutoCloseSignals (BE+trailing) → updateSignalResult → panteon+Bayes+CUSUM+killSwitch
```

**Kalıcılık:** `DBManager` (IndexedDB `UTC_PANTHEON_DB` v1) → `StorageBridge` (write-through cache, `ready` flag) → `Migration` (localStorage → IndexedDB tek seferlik, sonra temizler)

**Build:** Vite 5.4 ( `npm run build` → `dist/` 62 modül, 239kB / 71.9kB gzip)

---

## 📁 Klasör Yapısı

```
src/
├── core/          Config (DEFAULT_SETTINGS), State (STATE singleton), Utils, Logger
├── data/          BinanceStream (WS+backoff), ExchangeManager, MockDataGenerator, ZebaniFilter
├── indicators/    RSI, ATR, SMA, EMA, ADX, VWAP, Bollinger, SuperTrend (saf fonksiyonlar)
├── strategies/    Strategy base + 20 strateji + registry (index.js: CLASSES, AMBASSADORS, GROUPS)
│                  wallBounce, rsiDivergence, supportResistance, vwapReversion, fundingRateReversal,
│                  velocityScalping, breakoutPattern, marketStructure, volatilityBreakout,
│                  liquidationCascade, orderFlowMomentum, liquidityGaps, fibonacciRetracement,
│                  volumeProfile, smartMoneyConcepts, divergenceDetection, institutionalOrderFlow,
│                  microSpreadArbitrage, superTrend, candleCharacter
├── confluence/    ConfluenceEngine (decay+Bayes+MTF+gating+cooldown) + MultiTimeframeManager
├── risk/          RiskGuardian (Araf kill-switch), SpoofDetector, SessionProfiler, CUSUMDriftDetector, PositionManager (calculateLevels)
├── panteon/       PantheonManager (5 elçi: metatron/uriel/raphael/gabriel/michael, reputation 0-150, mod, kehanet)
├── render/        ChartManager (lightweight-charts), HeatmapManager, EffectsManager  // ChartRenderer/RenderEngine silindi
├── ui/            UIController, NotificationService, TtsService
├── storage/       DBManager (IndexedDB), StorageBridge, Migration
├── styles/        app.css (barva35 tema: dark/light/war, mobil)
└── app/           App.js (UltimateTradingCommandCenter) + main.js
tests/            21 birim test (strategy/panteon/CUSUM/indicators/utils)
```

---

## 🛠 Kurulum & Geliştirme

```bash
npm install          # lightweight-charts + capacitor dahil
npm run dev          # Vite dev server (HMR)
npm test             # node --test → 21/21 ✅
npm run build        # dist/ üret (vite build)
```

**Gereksinimler:** Node 20+, JDK 17 (APK için)

**Hızlı sağlık kontrolü:**
```bash
npm test && npm run build
# 21 pass, 62 modules, gzip ~72kB beklenir
```

---

## 📱 APK Üretimi

### Otomatik — GitHub Actions "🚀 ULTIMATE TRADING • Android APK Fabrikası"

`.github/workflows/build-apk.yml` her `main`/`develop` push'unda:

- 🕵️ Keşif (sürüm künyesi + debug/release matrix)
- 🧹 Kalite (`node --check` sözdizimi taraması)
- 🧪 Test (21 birim test + JUnit)
- 📦 Derleme (`vite build` → `cap sync android` → `gradle assemble` debug+release paralel)
- 🏷️ `v*` tag'inde APK'lar GitHub Release'e eklenir

```bash
git push origin main
git tag v2.1.0 && git push origin v2.1.0  # Release + APK
```

### Yerel (SDK varsa)

```bash
npm run build && npx cap add android && npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

> CORS kısıtı olan ortamlarda otomatik **mock moda** geçer; APK WebView `https` şemasıyla sorunsuz çalışır.

---

## 🔑 Veri Kaynakları (Binance Futures) — P0 Dual Routed WS (2026-04-23 Migration)

> **2026-04-23'te Binance legacy tek URL (`wss://fstream.binance.com/stream`) kaldırıldı.** Artık 2 routed endpoint var:
> - `wss://fstream.binance.com/public` → depth / bookTicker (yüksek frekans)
> - `wss://fstream.binance.com/market` → ticker / kline / aggTrade / forceOrder / markPrice
> Kod `BinanceStream` içinde **2 paralel WebSocket + Watchdog** ile yönetir. Eski tek URL artık sadece `/public` taşır.

| Veri | Stream / Endpoint | WS |
|------|-------------------|----|
| Fiyat / 24s değişim / hacim | `@ticker` (ZebaniFilter'den geçer) | **market** |
| Emir defteri (20 seviye) | `@depth20@100ms` → heatmap + spoof | **public** |
| Mumlar | `@kline_{tf}` + REST `/fapi/v1/klines?limit=500` | **market** |
| Trade'ler | `@aggTrade` (ham `@trade` de destekleniyor) → `processTrade` | **market** |
| Likidasyon (yakında) | `@forceOrder` → `LiquidationCascadeStrategy` (Faz D) | **market** |
| MTF teyidi | REST klines (5m/15m/1h/4h via `MultiTimeframeManager`) | REST |
| Fallback | `MockDataGenerator` (random walk) | mock |
| Sağlık | `ExchangeManager.getHealth()` + Watchdog (60s sessiz → uyarı + reconnect) | — |

---

## 📊 Stratejiler & Göstergeler

**20 Strateji (barva35 birebir):** WallBounce, RSI Divergence, Support/Resistance, VWAP Reversion, FundingRateReversal, VelocityScalping, BreakoutPattern, MarketStructure (BOS), VolatilityBreakout, LiquidationCascade, OrderFlowMomentum, LiquidityGaps, Fibonacci, VolumeProfile, SmartMoney (FVG), Divergence, InstitutionalOrderFlow, MicroSpread, SuperTrend, CandleCharacter

**Confluence:** `score = Σ(score×BayesWeight×e^(-age/3)×groupBoost[rejim+session]) - gatingPenalty - MTF×0.6`, `contrib≥2 & groups≥1`, `threshold+delta(0.5×panteon)`, `cooldown×panteonScale`

**Göstergeler:** RSI, ATR, SMA, EMA, ADX, VWAP, Bollinger, SuperTrend (+ MACD/Stoch/OBV için yer hazır)

**Panteon:** Her strateji bir elçiye bağlı → TP `elçi+3, raphael+1`, SL `tümü-1, elçi ekstra -2`, reputation [0,150] → mod `≥80 İNANÇLI, ≥50 ŞÜPHECİ, <50 KIYAMET` → `thresholdDelta / cooldownScale / rrMultiplier`

---

## 🧪 Test

```bash
npm test
# 21 test: clamp/median/mean, formatPrice, Pantheon TP/SL/mod, Strategy cooldown/shadow, WallBounce, CUSUM, RSI/ATR/SMA/EMA/Bollinger
```

*   `utils` saf fonksiyonlar
*   `indicators` matematiksel doğruluk
*   `panteon` itibar/mod
*   `CUSUM` drift
*   `strategies` propose/cooldown/shadow

---

## 🗺️ Yol Haritası

- [x] **Faz A — Kırık olanı onar** (12 patch ✅ bu sürüm)
- [x] **Faz B — Geri besleme döngülerini kapat** (6 entegrasyon ✅ bu sürüm)
- [ ] **Faz C — Görünürlük:** Strateji bazlı performans paneli (win-rate grafik), MTF özet UI (`5m:↑ 15m:↑ 1h:↓ 4h:→`), sinyal filtre/export (CSV/JSON), shadow near-miss logu
- [ ] **Faz D — Büyük özellikler:** Çoklu borsa arayüzü (`ExchangeManager` → `BinanceStream`/`BybitStream`...), çoklu sembol tarama/watchlist, backtest/walk-forward, bulut senkron (Firebase REST)

---

## 📄 Dokümanlar

- `PLAN.md` — mimari kararlar (barva35 tek referans)
- `docs/ARCHITECTURE.md` — veri akışı detayı
- `docs/API.md` — modül API referansı

---

## ⚖️ Uyarı

Bu yazılım **yatırım tavsiyesi değildir**. Sinyaller istatistiksel birleşimdir, geçmiş performans gelecekte kazanç garantisi vermez. Binance Futures yüksek kaldıraç risklidir — paper modda test etmeden gerçek para kullanmayın.

---

*Tek referans kaynak: `barva35.html` (ULTIMATE TRADING KOMUTA MERKEZİ) — modüler APK portu. PR ve issue'lar bekleriz!*
