/**
 * Migration — localStorage → IndexedDB geçişi (kaynak: UTC v2.0 §4.2)
 * Tek sefer çalışır; legacy anahtarları taşır.
 */
import { Logger } from '../core/Logger.js';

const LEGACY_KEYS = [
  'utc_settings', 'utc_strategy_stats', 'utc_signals', 'utc_stats',
  'utc_current_symbol', 'utc_current_timeframe', 'utc_header_collapsed',
  'utc_current_view', 'utc_theme', 'utc_chart_view'
];

const META_KEY = 'migrated_v3_2';

export class Migration {
  /**
   * @param {import('./DBManager.js').DBManager} db
   */
  static async runOnce(db) {
    if (!db?.ready) return false;
    try {
      const done = await db.load(META_KEY, 'meta');
      if (done) return false;

      let moved = 0;
      for (const key of LEGACY_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try {
          const parsed = JSON.parse(raw);
          await db.save(key, parsed);
          // Faz A #7: Migration artık kaynak localStorage'ı temizliyor (tek kaynak IndexedDB kalsın)
          localStorage.removeItem(key);
          moved++;
        } catch (e) {
          Logger.debug('Migration', `${key} taşınamadı:`, e.message);
        }
      }

      await db.save(META_KEY, { ts: Date.now(), moved }, 'meta');
      Logger.info('Migration', `${moved} anahtar IndexedDB'ye taşındı`);
      return moved > 0;
    } catch (e) {
      Logger.warn('Migration', 'hata:', e.message);
      return false;
    }
  }
}

export default Migration;
