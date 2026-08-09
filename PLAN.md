# 📱 BOZOK TERMINAL MOBILE — Uygulama Planı (v1.0)

> Kaynak dokümanlar: `BOZOK_PRO_TEKNİK_DOKÜMAN.md` (mikroyapı) + `TRADING_TERMINAL_TEKNIK_DOKUMAN v2.0` (strateji/confluence) + `barva35.html` (referans implementasyon)

---

## 1. Teknoloji Kararı

| Karar | Seçim | Gerekçe |
|---|---|---|
| **Uygulama çekirdeği** | Vanilla JS (ES Modules) | Kaynak kodlar saf JS class mimarisi — çerçeve (framework) dayatmadan birebir modüler taşıma |
| **Mobil kabuk** | **Capacitor 6** (Android) | HTML/JS uygulamayı native WebView'e paketler → gerçek `.apk` üretir, SDK ihtiyacı yok |
| **Modül paketleyici** | Vite | ES module'ları tek bundle'a alır, `capacitor` ile uyumlu, dev sunucusu hazır |
| **Otomatik APK** | GitHub Actions | `push`/`tag` üzerine Android build → APK artifact + Release'e eklenir |
| **Veri** | Binance Futures WS + REST, mock fallback | Birebir kaynak dokümanlar ile aynı |
| **Kalıcılık** | localStorage + IndexedDB (write-through) | Kaynak dokümandaki StorageBridge deseni |

> Neden React Native / Flutter değil? Kaynak kodlar saf HTML/JS. Capacitor bu mimariyi korur, tüm sınıflar modüler kalır, APK üretimi CI'da otomatiktir.

## 2. Mimari Diyagram

```
┌────────────────────────────────────────────────────────────┐
│                      BOZOK TERMINAL MOBILE                  │
│                                                            │
│  ┌──────────────┐   WS+REST   ┌──────────────────┐         │
│  │ ExchangeManager │◄────────►│ Binance Futures  │         │
│  │ (+Bybit/OKX/MEXC│          │ + Cross-Exchange │         │
│  │  polling, mock) │          └──────────────────┘         │
│  └──────┬──────────┘                                       │
│         ▼                                                   │
│  ┌──────────────────┐    EventBus (pub/sub)                │
│  │      EventBus    │◄── TÜM modüller arası iletişim        │
│  └──────┬───────────┘                                       │
│    ┌────┼────┬──────────┬──────────┬──────────┐            │
│    ▼    ▼    ▼          ▼          ▼          ▼            │
│ ┌─────┐┌─────┐┌────────┐┌────────┐┌────────┐┌──────────┐  │
│ │Micro││Trade││  Flow  ││Detector││Signal  ││ Paper    │  │
│ │stru-││Engine││ Engine ││ Suite  ││ Engine ││ Trading  │  │
│ │cture││(CVD,││(candle)││ (9 tür)││(plan,  ││ Engine   │  │
│ │Engine││ VPIN)││        ││        ││ Kelly) ││          │  │
│ └──┬──┘└──┬──┘└───┬────┘└───┬────┘└───┬────┘└────┬─────┘  │
│    │       │       │         │         │          │        │
│    ▼       ▼       ▼         ▼         ▼          ▼        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 20 STRATEJİ → ConfluenceEngine → Panteon → RiskGuardian│   │
│ │ (WallBounce, RSI Div, ...)  (decay, gating) (mod, atlı)│   │
│ └──────────────────────────┬───────────────────────────┘   │
│                            ▼                                │
│  ┌──────────────────────────────────────────────┐          │
│  │        RenderEngine (Canvas) + UIController  │          │
│  │  Book / Flow / CVD / Equity / Chart / Ladder │          │
│  └──────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────┘
```

## 3. Klasör Yapısı

```
bozok-mobile/
├── .github/workflows/build-apk.yml   → push/tag'te otomatik APK
├── android/                          → Capacitor native (CI'da üretilir, commit edilir)
├── docs/                             → mimari ve API dokümanları
├── src/
│   ├── main.js                       → bootstrap
│   ├── index.html                    → SPA kabuk (mobil-first)
│   ├── styles/                       → tema (professional/neon/minimal + war)
│   ├── core/                         → Config, State, EventBus, Utils, Logger
│   ├── data/                         → ExchangeManager, BinanceStream, Mock, ZebaniFilter
│   ├── engines/                      → Microstructure, Trade, Flow, Signal, PaperTrading
│   ├── detectors/                    → DetectorSuite + 9 dedektör
│   ├── strategies/                   → Strategy base + 20 strateji + registry
│   ├── confluence/                   → ConfluenceEngine, BayesianWeighting, MTF
│   ├── indicators/                   → RSI, ATR, EMA, SMA, BB, ADX, VWAP, SuperTrend
│   ├── risk/                         → RiskGuardian, PositionManager, CUSUM
│   ├── panteon/                      → PantheonManager, TheOracle, PantheonEffects
│   ├── render/                       → RenderEngine + grafik renderer'ları
│   ├── ui/                           → UIController, SignalFeed, TtsService
│   ├── storage/                      → StorageService, Migration, StorageBridge
│   └── app/App.js                    → UltimateTerminal (orchestrator)
├── package.json
├── vite.config.js
├── capacitor.config.json
├── README.md
├── PLAN.md
└── TODO.md
```

## 4. Modül Sorumlulukları (Kaynak → Modül Eşlemesi)

| Kaynak Modül | Hedef Modül(ler) |
|---|---|
| `EventBus` (BOZOK §2) | `core/EventBus.js` |
| `CONFIG`/`STATE` (BOZOK §3) | `core/Config.js`, `core/State.js` |
| `MicrostructureEngine` (BOZOK §4) | `engines/MicrostructureEngine.js` |
| `TradeEngine` — CVD/VPIN (BOZOK §5) | `engines/TradeEngine.js` |
| `FlowEngine` (BOZOK §6) | `engines/FlowEngine.js` |
| 9 Dedektör (BOZOK §7) | `detectors/*.js` |
| `SignalEngine` (BOZOK §8) | `engines/SignalEngine.js` |
| `PaperTradingEngine` (BOZOK §9) | `engines/PaperTradingEngine.js` |
| `RenderEngine` (BOZOK §10) | `render/RenderEngine.js` + renderer'lar |
| `ExchangeManager` (BOZOK §11) | `data/ExchangeManager.js`, `data/BinanceStream.js` |
| `UIController` (BOZOK §12) | `ui/UIController.js` |
| Decay & Expiry (BOZOK §13) | `engines/SignalEngine.js` içinde |
| Tema (BOZOK §14) | `styles/themes.css` |
| localStorage (BOZOK §15) | `storage/StorageService.js` |
| 20 Strateji (UTC §5) | `strategies/*.js` |
| ConfluenceEngine (UTC §6) | `confluence/ConfluenceEngine.js` |
| Göstergeler (UTC §7) | `indicators/*.js` |
| Oto-Optimizasyon (UTC §10) | `confluence/BayesianWeighting.js` |
| Panteon (UTC §13) | `panteon/PantheonManager.js` |
| TheOracle (UTC §14) | `panteon/TheOracle.js` |
| IndexedDB/Migration (UTC §16-17) | `storage/*.js` |
| RiskGuardian (UTC §20) | `risk/RiskGuardian.js` |

## 5. APK Üretim Akışı (CI)

```
git push → GitHub Actions (ubuntu-latest, JDK 17)
  ├─ npm ci
  ├─ npx vite build          → dist/ (bundle + index.html)
  ├─ npx cap sync android    → android/ projesi eşitlenir
  ├─ cd android && ./gradlew assembleDebug
  ├─ APK: android/app/build/outputs/apk/debug/app-debug.apk
  ├─ Artifact olarak yükle + (tag ise) GitHub Release'e ekle
```

## 6. Felsefe

- **Tüm sınıflar tek sorumluluk** — her dosya bir sınıf, her sınıf test edilebilir
- **EventBus üzerinden iletişim** — modüller birbirini tanımaz
- **Kaynak formüllere sadakat** — VPIN, CVD, pressure, Kelly, decay, Bayesian ağırlık formülleri birebir korunur
- **Mobil-first UI** — alt sekmeler, dokunmatik kontroller, ekran tasarrufu
- **Hatasız çalışan temel** — dokümandaki kritik buglar (sınıf erken kapanma, syntax hataları) modüler yapıda asla oluşmaz
