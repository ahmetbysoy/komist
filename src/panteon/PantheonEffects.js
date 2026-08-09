/**
 * PantheonEffects — Görsel + ses efektleri
 * Kaynak: UTC v2.0 §12 + GPTE.HTML (PantheonEffects)
 * Web Audio API tabanlı ses + DOM tabanlı görsel efektler.
 */
import { Logger } from '../core/Logger.js';

export class PantheonEffects {
  constructor() {
    this.audioCtx = null;
    this.enabled = { sound: false, visuals: true };
  }

  setEnabled({ sound, visuals } = {}) {
    if (sound !== undefined) this.enabled.sound = sound;
    if (visuals !== undefined) this.enabled.visuals = visuals;
  }

  // ── Ses (Web Audio API) ───────────────────────────────
  _ensureCtx() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        Logger.debug('Effects', 'AudioContext yok');
        return null;
      }
    }
    return this.audioCtx;
  }

  _tone({ freq = 800, type = 'triangle', dur = 0.2, vol = 0.1, delay = 0 } = {}) {
    if (!this.enabled.sound) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch (_) {}
  }

  playBuy() {
    this._tone({ freq: 1000, type: 'triangle', dur: 0.2 });
  }

  playSell() {
    this._tone({ freq: 400, type: 'square', dur: 0.2 });
  }

  playConflict() {
    this._tone({ freq: 800, type: 'sawtooth', dur: 1.0, vol: 0.08 });
  }

  playTp() {
    this._tone({ freq: 880, type: 'sine', dur: 0.25 });
    this._tone({ freq: 1320, type: 'sine', dur: 0.3, delay: 0.12 });
  }

  playSl() {
    this._tone({ freq: 220, type: 'sawtooth', dur: 0.35, vol: 0.12 });
  }

  // ── Görsel (DOM) ──────────────────────────────────────
  _flash(color, dur = 600) {
    if (!this.enabled.visuals) return;
    let el = document.getElementById('fx-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fx-flash';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3000;opacity:0;transition:opacity .4s;';
      document.body.appendChild(el);
    }
    el.style.background = color;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, dur);
  }

  buyBurst() {
    this.playBuy();
    this._flash('radial-gradient(circle, rgba(34,197,94,.18), transparent 70%)');
  }

  sellAsh() {
    this.playSell();
    this._flash('radial-gradient(circle, rgba(239,68,68,.18), transparent 70%)');
  }

  tpCelebrate() {
    this.playTp();
    this._flash('radial-gradient(circle, rgba(250,204,21,.22), transparent 70%)');
  }

  slExplosion() {
    this.playSl();
    this._flash('radial-gradient(circle, rgba(127,29,29,.28), transparent 70%)');
  }

  horsemanFlash(horseman) {
    const colors = {
      SAVAŞ: 'radial-gradient(circle, rgba(252,211,77,.2), transparent 70%)',
      KITLIK: 'radial-gradient(circle, rgba(100,116,139,.2), transparent 70%)',
      SALGIN: 'radial-gradient(circle, rgba(239,68,68,.3), transparent 70%)',
      ÖLÜM: 'radial-gradient(circle, rgba(125,211,252,.2), transparent 70%)'
    };
    this._flash(colors[horseman] || 'rgba(255,255,255,.15)', 900);
  }
}

export default PantheonEffects;
