/**
 * EffectsManager — Partikül efektleri (barva35/gemi ailesi)
 * tsParticles yerine hafif canvas çizimi (offline APK güvenli).
 * buy: yeşil-altın yukarı, sell: kırmızı-bordo aşağı, tp: altın, sl: kırmızı, divine: beyaz-mavi.
 */
import { Logger } from '../core/Logger.js';

const PRESETS = {
  buy:   { colors: ['#28a745', '#facc15'], direction: -1, gravity: 9.81, life: 500, count: 40, size: 3 },
  sell:  { colors: ['#dc3545', '#7f1d1d'], direction: 1, gravity: 9.81, life: 500, count: 40, size: 3 },
  tp:    { colors: ['#facc15', '#ffd700'], direction: 0, gravity: 0, life: 800, count: 55, size: 3 },
  sl:    { colors: ['#dc3545', '#fd7e14'], direction: 1, gravity: 12, life: 300, count: 50, size: 3 },
  divine:{ colors: ['#ffffff', '#7dd3fc'], direction: -1, gravity: 2.0, life: 600, count: 45, size: 4 }
};

export class EffectsManager {
  constructor(canvasId = 'effects-canvas') {
    this.canvas = document.getElementById(canvasId);
    // effects-canvas barva35'te div (tsparticles için), canvas değil — getContext kontrolü ekle
    if (this.canvas && typeof this.canvas.getContext === 'function') {
      this.ctx = this.canvas.getContext('2d');
    } else {
      // Canvas değilse (div) veya yoksa, görünmez canvas oluştur veya no-op yap
      this.ctx = null;
      // Eğer div ise, içine gizli canvas oluşturmayı dene (opsiyonel)
      if (this.canvas && this.canvas.tagName !== 'CANVAS') {
        // Div için tsparticles kullanıldığı varsayılır, partikül canvas'ı ayrı yönetilecek
        this.ctx = null;
      }
    }
    this.particles = [];
    this.running = false;
    this.enabled = true;
  }

  start() {
    if (!this.ctx || this.running || typeof this.canvas?.getContext !== 'function') return;
    this.running = true;
    const loop = () => {
      this._tick();
      if (this.running) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    this.particles = [];
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.particles = [];
  }

  /** Efekt fırlat (barva35 playSignal mantığı) */
  emit(type) {
    if (!this.enabled || !this.ctx) return;
    const preset = PRESETS[type] || PRESETS.buy;
    const { w, h } = this._size();
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < preset.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (preset.direction || 0) * 30,
        color: preset.colors[Math.floor(Math.random() * preset.colors.length)],
        size: preset.size * (0.5 + Math.random()),
        life: preset.life * (0.6 + Math.random() * 0.8),
        born: performance.now(),
        gravity: preset.gravity
      });
    }
    if (!this.running) this.start();
  }

  _size() {
    if (this.canvas) {
      return { w: this.canvas.width, h: this.canvas.height };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  }

  _tick() {
    if (!this.ctx || !this.canvas || typeof this.canvas.getContext !== 'function') return;
    const { w, h } = this._size();
    this.ctx.clearRect(0, 0, w, h);
    const nowMs = performance.now();

    this.particles = this.particles.filter((p) => nowMs - p.born < p.life);
    for (const p of this.particles) {
      p.vy += p.gravity * 0.016;
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      const alpha = 1 - (nowMs - p.born) / p.life;
      this.ctx.globalAlpha = Math.max(0, alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }
}

export default EffectsManager;
