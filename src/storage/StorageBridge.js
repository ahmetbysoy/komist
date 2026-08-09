/**
 * StorageBridge — Write-Through Cache (kaynak: UTC v2.0 §17 / GPTE.HTML)
 * Senkron Map cache (O(1) okuma) + arka planda IndexedDB persist.
 */
import { StorageService } from './StorageService.js';

export class StorageBridge {
  constructor(db) {
    this.db = db || new StorageService();
    this.cache = new Map();
    this.ready = false;
  }

  async init() {
    // Ön-yükleme: kritik anahtarları paralel çek
    const keys = ['utc_current_symbol', 'utc_current_timeframe', 'utc_theme',
                  'utc_current_view', 'utc_strategy_stats'];
    const results = await Promise.all(keys.map((k) => this.db.get(k)));
    keys.forEach((k, i) => {
      if (results[i] !== null && results[i] !== undefined) this.cache.set(k, results[i]);
    });
    this.ready = true;
  }

  /** Senkron okuma (cache'ten) */
  getJsonSync(key) {
    return this.ready ? this.cache.get(key) : null;
  }

  /** Yazma: anında cache, arka planda persist */
  setJson(key, val) {
    this.cache.set(key, val);
    this.db.set(key, val);
  }

  /** Ana uygulamanın veri metodlarını override et (monkey-patch) */
  inject(app) {
    if (!app) return;
    app.loadData = (k) => this.getJsonSync(k) ?? app.loadData?.(k);
    app.saveData = (k, d) => this.setJson(k, d);
    const origSave = app.saveSettings?.bind(app);
    app.saveSettings = () => {
      this.setJson('utc_settings', app.settings);
      origSave?.();
    };
  }
}

export default StorageBridge;
