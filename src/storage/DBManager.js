/**
 * DBManager — IndexedDB veritabanı yöneticisi
 * Kaynak: barva35.html / GPTE.HTML (UTC_PANTHEON_DB v1, 7 store)
 * Store'lar: settings, panteon, strategyStats, signals, notifications, kv, meta
 */
import { Logger } from '../core/Logger.js';

const DB_NAME = 'UTC_PANTHEON_DB';
const DB_VERSION = 1;

export class DBManager {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  async init() {
    if (!('indexedDB' in window)) return false;
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          const stores = {
            settings: 'id',
            panteon: 'id',
            strategyStats: 'strategyKey',
            notifications: 'id',
            kv: 'key',
            meta: 'key'
          };
          for (const [name, key] of Object.entries(stores)) {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, { keyPath: key });
            }
          }
          // signals: autoIncrement + indeksler
          if (!db.objectStoreNames.contains('signals')) {
            const sig = db.createObjectStore('signals', { keyPath: 'id', autoIncrement: true });
            sig.createIndex('byTimestamp', 'timestamp');
            sig.createIndex('bySymbol', 'symbol');
            sig.createIndex('byStatus', 'status');
            sig.createIndex('byDirection', 'direction');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.ready = true;
      Logger.info('DB', 'IndexedDB hazır');
      return true;
    } catch (e) {
      Logger.warn('DB', 'IndexedDB açılamadı:', e.message);
      return false;
    }
  }

  _tx(store, mode) {
    return this.db.transaction(store, mode).objectStore(store);
  }

  _req(req) {
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async load(key, store = 'kv') {
    if (!this.ready) return null;
    try {
      const r = await this._req(this._tx(store, 'readonly').get(key));
      return r?.data ?? r ?? null;
    } catch (_) { return null; }
  }

  async save(key, data, store = 'kv') {
    if (!this.ready) return;
    try {
      await this._req(this._tx(store, 'readwrite').put({ ...data, key }));
    } catch (e) {
      Logger.debug('DB', `save ${key} hatası:`, e.message);
    }
  }

  async remove(key, store = 'kv') {
    if (!this.ready) return;
    try {
      await this._req(this._tx(store, 'readwrite').delete(key));
    } catch (_) {}
  }

  async getAll(store) {
    if (!this.ready) return [];
    try {
      const r = await this._req(this._tx(store, 'readonly').getAll());
      return r || [];
    } catch (_) { return []; }
  }

  async clearStore(store) {
    if (!this.ready) return;
    try {
      await this._req(this._tx(store, 'readwrite').clear());
    } catch (_) {}
  }
}

export default DBManager;
