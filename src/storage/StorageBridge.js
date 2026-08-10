/**
 * StorageBridge — Write-Through Cache (kaynak: GPTE.HTML §17)
 * Senkron Map cache (O(1)) + arka planda IndexedDB persist.
 */
import { DBManager } from './DBManager.js';

export class StorageBridge {
  constructor(db) {
    this.db = db || new DBManager();
    this.cache = new Map();
    this.ready = false;
  }

  async init() {
    await this.db.init();
    // Kritik anahtarları paralel ön-yükle
    const keys = ['utc_settings', 'utc_strategy_stats', 'utc_signals', 'utc_stats',
                  'utc_current_symbol', 'utc_current_timeframe', 'pantheon_state'];
    const results = await Promise.all(keys.map((k) => this.db.load(k)));
    keys.forEach((k, i) => {
      if (results[i] !== null && results[i] !== undefined) this.cache.set(k, results[i]);
    });
    this.ready = true;
  }

  /** Senkron okuma */
  getJsonSync(key) {
    return this.ready ? this.cache.get(key) : null;
  }

  /** Anında cache + arka planda persist */
  setJson(key, val) {
    this.cache.set(key, val);
    this.db.save(key, val);
  }
}

export default StorageBridge;
