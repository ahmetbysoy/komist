/**
 * StorageService — localStorage wrapper (BOZOK PRO §15) + IndexedDB (UTC §16)
 * Ayarlar + runtime durum kalıcılığı. Kullanılabilirse IndexedDB, yoksa localStorage.
 */
import { Logger } from '../core/Logger.js';

const SETTINGS_KEY = 'BOZOK_TERMINAL_SETTINGS';

export class StorageService {
  constructor() {
    this.db = null;
    this.dbReady = false;
  }

  // ── IndexedDB ────────────────────────────────────────
  async initIndexedDB() {
    if (!('indexedDB' in window)) { this.dbReady = false; return; }
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('BOZOK_TERMINAL_DB', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('signals')) db.createObjectStore('signals', { keyPath: 'id', autoIncrement: true });
          if (!db.objectStoreNames.contains('panteon')) db.createObjectStore('panteon', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.dbReady = true;
      Logger.info('Storage', 'IndexedDB hazır');
    } catch (e) {
      Logger.warn('Storage', 'IndexedDB açılamadı, localStorage fallback:', e.message);
    }
  }

  async _idbPut(key, value) {
    if (!this.dbReady) return false;
    return new Promise((resolve) => {
      const tx = this.db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ key, value: JSON.stringify(value) });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async _idbGet(key) {
    if (!this.dbReady) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => {
        try { resolve(req.result ? JSON.parse(req.result.value) : null); }
        catch (_) { resolve(null); }
      };
      req.onerror = () => resolve(null);
    });
  }

  // ── Ayarlar ──────────────────────────────────────────
  saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
    this._idbPut(SETTINGS_KEY, settings);
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  async loadSettingsAsync() {
    const ls = this.loadSettings();
    if (ls) return ls;
    return this._idbGet(SETTINGS_KEY);
  }

  // ── Genel KV ─────────────────────────────────────────
  async get(key) {
    const ls = localStorage.getItem(key);
    if (ls !== null) {
      try { return JSON.parse(ls); } catch (_) { return ls; }
    }
    return this._idbGet(key);
  }

  async set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    return this._idbPut(key, value);
  }

  async remove(key) {
    localStorage.removeItem(key);
    if (this.dbReady) {
      this.db.transaction('kv', 'readwrite').objectStore('kv').delete(key);
    }
  }

  // ── Sinyal geçmişi (IndexedDB) ───────────────────────
  async saveSignal(signal) {
    if (!this.dbReady) return;
    try {
      const tx = this.db.transaction('signals', 'readwrite');
      tx.objectStore('signals').add(signal);
    } catch (e) {
      Logger.debug('Storage', 'sinyal kaydı hatası:', e.message);
    }
  }
}

export default StorageService;
