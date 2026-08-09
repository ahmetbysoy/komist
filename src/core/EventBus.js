/**
 * EventBus — Publish/Subscribe (kaynak: BOZOK PRO §2)
 * Tüm modüller arası iletişim buradan geçer; modüller birbirini tanımaz.
 * Event handling hataları diğer subscriber'ları etkilemez (try-catch izolasyonu).
 */
export class EventBus {
  constructor() {
    this.map = new Map(); // event → Set<callback>
  }

  /** Dinleyici kaydet, unsubscribe fonksiyonu döner */
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }

  /** Dinleyici kaldır */
  off(evt, fn) {
    const s = this.map.get(evt);
    if (s) s.delete(fn);
  }

  /** Event'i tetikle — dinleyiciler sırayla, izole çağrılır */
  emit(evt, data) {
    const s = this.map.get(evt);
    if (!s || s.size === 0) return;
    for (const fn of [...s]) {
      try { fn(data); }
      catch (e) { console.error(`[EventBus:${evt}]`, e); }
    }
  }

  /** Tek seferlik dinleyici */
  once(evt, fn) {
    const off = this.on(evt, (d) => { off(); fn(d); });
  }

  /** Bir event'teki dinleyici sayısı (debug) */
  listenerCount(evt) {
    return this.map.get(evt)?.size || 0;
  }

  /** Tüm dinleyicileri temizle */
  clear() {
    this.map.clear();
  }
}

export default EventBus;
