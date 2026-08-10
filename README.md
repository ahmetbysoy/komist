# 🏛️ ULTIMATE TRADING KOMUTA MERKEZİ

**Barva35.html** referans dosyasından modüler olarak kodlanmış, **Capacitor** ile Android `.apk` üretilen mobil trading analiz terminali.

> ⚠️ Bu uygulama **gerçek trade execution yapmaz.** Sadece sinyal üretir, önerir ve takip eder (TP/SL takibi dahil).

## ✨ Özellikler (barva35.html ile birebir)

| Katman | İçerik |
|---|---|
| **20 Strateji** | WallBounce, RSI Divergence, Support/Resistance, VWAP Reversion, FundingRate, Velocity Scalping, Breakout, MarketStructure (BOS), VolatilityBreakout, LiquidationCascade, OrderFlowMomentum, LiquidityGaps, Fibonacci, VolumeProfile, SmartMoney (FVG), Divergence, InstitutionalOrderFlow, MicroSpread, SuperTrend, CandleCharacter |
| **Confluence Motoru** | Zaman çürümesi `e^(-age/3)`, Beta-Binomial Bayes ağırlık, MTF trend teyidi (×0.6), gating (spread/derinlik), cooldown + histerezis + yön marjı |
| **Panteon** | Metatron / Uriel / Raphael — itibar sistemi, modlar (İNANÇLI/ŞÜPHECİ/KIYAMET), kehanet (🛡️⚖️⚔️) |
| **Risk** | Araf Protokolü (kill switch: WR < %35 → durdur), CUSUM drift, spoof detektör, breakeven + trailing stop |
| **Grafik** | Lightweight Charts (mum + hacim + BB), TP ▲ / SL ▼ marker'lar, zoom/fullscreen |
| **Isı Haritası** | Emir defteri (orderbook) canlı heatmap |
| **Ses** | TTS (tr-TR) + kuyruk, partikül efektleri |
| **UI** | Sinyal barları (METATRON GÜVENİ / URIEL CESARETİ), kehanet paneli, ayarlar modal, sinyal geçmişi tablosu, 3 tema (dark/light/war) |

## 📁 Klasör Yapısı

```
src/
├── core/        Config (barva35 settings), State, Utils, Logger
├── data/        BinanceStream (4 stream), ExchangeManager, Mock, Zebani
├── strategies/  Strategy base + 20 strateji + registry
├── confluence/  ConfluenceEngine, MultiTimeframeManager
├── risk/        RiskGuardian, SpoofDetector, SessionProfiler, CUSUM, PositionManager
├── panteon/     PantheonManager (3 elçi)
├── render/      ChartManager (Lightweight Charts), HeatmapManager, EffectsManager
├── ui/          UIController, NotificationService, TtsService
├── storage/     DBManager (IndexedDB), StorageBridge, Migration
└── app/         App.js (UltimateTradingCommandCenter) + main.js
```

## 🛠 Geliştirme

```bash
npm install          # bağımlılıklar (lightweight-charts dahil)
npm run dev          # Vite dev sunucusu
npm test             # 20 birim test (node --test)
npm run build        # dist/ üret
```

## 📱 APK Üretimi

### Otomatik — GitHub Actions "🚀 ULTIMATE TRADING • Android APK Fabrikası"
`.github/workflows/build-apk.yml` her `main`/`develop` push'unda:
- 🕵️ Keşif (sürüm künyesi + debug/release matrix)
- 🧹 Kalite (JS sözdizimi taraması)
- 🧪 Test (20 birim test + JUnit raporu)
- 📦 Derleme (Vite → Capacitor sync → Debug & Release APK paralel)
- 🏷️ `v*` tag'inde APK'lar otomatik GitHub Release'e eklenir

```bash
git push origin main
git tag v1.0.0 && git push origin v1.0.0   # Release + APK
```

### Yerel (SDK varsa)
```bash
npm run build && npx cap add android && npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 🔑 Veri Kaynakları (Binance Futures)

| Veri | Stream/Endpoint |
|---|---|
| Fiyat / 24s değişim / hacim | WS `@ticker` |
| Emir defteri (20 seviye) | WS `@depth20@100ms` |
| Mumlar | WS `@kline_{tf}` + REST `/fapi/v1/klines` |
| Trade'ler | WS `@aggTrade` |
| MTF trend teyidi | REST klines (5m/15m/1h/4h) |
| Fallback | Mock veri üretici (random walk) |

> CORS kısıtı olan ortamlarda uygulama otomatik **mock moda** geçer; APK WebView'de `https` şemasıyla çalışır.

## 📄 Dokümanlar

- [PLAN.md](./PLAN.md) — mimari kararlar
- [TODO.md](./TODO.md) — görev takibi
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — veri akışı
- [docs/API.md](./docs/API.md) — modül API referansı

---
*Tek referans kaynak: barva35.html (ULTIMATE TRADING KOMUTA MERKEZİ)*
