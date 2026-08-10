/**
 * SessionProfiler — Seans tespiti (Asya/Londra/New York)
 * Kaynak: barva35.html (kp-session paneli) — UTC saat diliminde.
 */
import { CONFIG } from '../core/Config.js';

export class SessionProfiler {
  constructor() {
    this.current = 'unknown';
  }

  detect() {
    const h = new Date().getUTCHours();
    const { asia, london, newyork } = CONFIG.session;
    let s = 'off';
    if (h >= asia[0] && h < asia[1]) s = 'ASYA';
    if (h >= london[0] && h < london[1]) s = 'LONDRA';
    if (h >= newyork[0] && h < newyork[1]) s = 'NEW YORK';
    this.current = s;
    return s;
  }

  getIcon() {
    return { ASYA: '🌏', LONDRA: '🇬🇧', 'NEW YORK': '🗽', off: '🌙' }[this.current] || '🌙';
  }
}

export default SessionProfiler;
