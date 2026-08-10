# 📱 ULTIMATE TRADING KOMUTA MERKEZİ — Uygulama Planı (v2.0)

> **Tek referans kaynak: barva35.html** (ULTIMATE TRADING KOMUTA MERKEZİ).
> Tasarım, görünüm ve mimari barva35 ile birebir; modüler dosya yapısıyla mobil APK.

## 1. Teknoloji

| Karar | Seçim |
|---|---|
| Çekirdek | Vanilla JS (ES Modules) — barva35 sınıf mimarisi |
| Mobil kabuk | Capacitor 6 (Android APK) |
| Bundler | Vite |
| Grafik | Lightweight Charts v3.8 (npm — offline APK güvenli) |
| CI | GitHub Actions (otomatik APK, matrix debug/release) |

## 2. Mimari (barva35 UltimateTradingCommandCenter)

```
Binance WS (4 stream) ─► UltimateTradingCommandCenter (App.js)
  ├─ @ticker     → marketData + pozisyon yönetimi + auto-close
  ├─ @depth20    → orderBook + heatmap + spoof + strateji.analyzeOrderBook
  ├─ @kline      → candles + chart + mum kapanışı (pending onay + indikatör)
  └─ @aggTrade   → strateji.processTrade

Strateji önerisi → ConfluenceEngine
  ├─ zaman çürümesi + Bayes ağırlık + MTF teyidi + gating + cooldown
  └─ generateFinalSignal → pending (mum onayı) / aktif
       └─ activateSignal → marker + bildirim + TTS + efekt + boyut
            └─ TP/SL takibi → checkAutoCloseSignals → panteon + istatistik + CUSUM
```

## 3. Modül Eşlemesi (barva35 sınıfları → dosyalar)

| barva35 sınıfı | Hedef dosya |
|---|---|
| `UltimateTradingCommandCenter` | `src/app/App.js` |
| `Strategy` + 20 strateji | `src/strategies/*.js` |
| `ConfluenceEngine` | `src/confluence/ConfluenceEngine.js` |
| `MultiTimeframeManager` | `src/confluence/MultiTimeframeManager.js` |
| `RiskGuardian` | `src/risk/RiskGuardian.js` |
| `SpoofDetector` | `src/risk/SpoofDetector.js` |
| `SessionProfiler` | `src/risk/SessionProfiler.js` |
| `CUSUMDriftDetector` | `src/risk/CUSUMDriftDetector.js` |
| `PanteonManager` (3 elçi) | `src/panteon/PantheonManager.js` |
| `ChartManager` | `src/render/ChartManager.js` |
| `HeatmapManager` | `src/render/HeatmapManager.js` |
| `EffectsManager` | `src/render/EffectsManager.js` |
| TTS / bildirim / UI | `src/ui/*.js` |
| `DBManager` + `StorageBridge` + `Migration` | `src/storage/*.js` |
| WS bağlantısı (handleMarketData) | `src/data/*.js` |

## 4. APK Üretim Akışı (CI)

```
git push → Actions (ubuntu, JDK 17, Node 20)
  ├─ npm ci → vite build → cap add/sync android
  ├─ recon (sürüm + matrix) → quality (JS lint) → test (JUnit)
  ├─ build: assembleDebug + assembleRelease (paralel, matrix)
  ├─ keystore varsa release imzası
  └─ tag v* → GitHub Release'e APK
```

## 5. Felsefe

- **Barva35 birebir**: görünüm, tema, paneller, formüller, akış aynı
- **Modüler**: her sınıf ayrı dosya, tek sorumluluk
- **Offline APK**: Lightweight Charts npm'de; CDN bağımlılığı yok
