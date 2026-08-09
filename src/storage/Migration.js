/**
 * Migration — localStorage → IndexedDB geçişi (kaynak: UTC v2.0 §4.2)
 * Tek sefer çalışır; legacy anahtarları IndexedDB'ye taşır.
 */
import { Logger } from '../core/Logger.js';

const LEGACY_KEYS = [
  'utc_settings', 'utc_strategy_stats', 'utc_signals', 'utc_stats',
  'utc_current_symbol', 'utc_current_timeframe', 'utc_header_collapsed',
  'utc_current_view', 'utc_theme', 'utc_chart_view',
  'BOZOK_PRO_SETTINGS'
];

const META_KEY = 'bozok_migrated_v2';

export class Migration {
  /**
   * @param {StorageService} storage
   * @returns {Promise<boolean>} yeni migrasyon yapıldı mı
   */
  static async runOnce(storage) {
    if (storage.dbReady === false) return false;
    try {
      const done = await storage._idbGet(META_KEY);
      if (done) return false;

      let moved = 0;
      for (const key of LEGACY_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try {
          const parsed = JSON.parse(raw);
          await storage._idbPut(key, parsed);
          moved++;
        } catch (e) {
          Logger.debug('Migration', `${key} taşınamadı:`, e.message);
        }
      }

      await storage._idbPut(META_KEY, { ts: Date.now(), moved });
      Logger.info('Migration', `${moved} anahtar IndexedDB'ye taşındı`);
      return moved > 0;
    } catch (e) {
      Logger.warn('Migration', 'migrasyon hatası:', e.message);
      return false;
    }
  }
}

export default Migration;
