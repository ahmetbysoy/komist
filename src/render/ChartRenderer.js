/**
 * ChartRenderer — Mum grafiği (canvas tabanlı, CDN'siz)
 * Kaynak: UTC v2.0 §4.5 (ChartManager) — Lightweight Charts yerine
 * bağımsız canvas çizimi (mobil offline çalışma garantisi).
 * Mumlar + EMA20/EMA50 overlay + hacim histogramı.
 */
import { STATE } from '../core/State.js';
import { ema } from '../indicators/EMA.js';

export class ChartRenderer {
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.bus = bus;
    this.visibleCount = 60;
  }

  render() {
    const canvas = this.canvas;
    const rect = canvas.parentElement?.getBoundingClientRect?.();
    if (!rect || rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.floor(rect.width * dpr));
    const H = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const candles = STATE.candles;
    if (candles.length < 10) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '12px monospace';
      ctx.fillText('Mum verisi bekleniyor...', 12, h / 2);
      return;
    }

    const show = candles.slice(-this.visibleCount);
    const padR = 8, volH = h * 0.18;
    const chartH = h - volH - 10;

    let minL = Infinity, maxH = -Infinity, maxVol = 0;
    for (const c of show) {
      minL = Math.min(minL, c.low);
      maxH = Math.max(maxH, c.high);
      maxVol = Math.max(maxVol, c.volume || 0);
    }
    const range = maxH - minL || 1;
    const cw = w / show.length;
    const toX = (i) => i * cw + cw / 2;
    const toY = (p) => padR + (1 - (p - minL) / range) * (chartH - padR * 2);

    // Izgara
    ctx.strokeStyle = 'rgba(139,148,158,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = padR + (chartH - padR * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }

    // Mumlar
    show.forEach((c, i) => {
      const bull = c.close >= c.open;
      const color = bull ? '#10b981' : '#ef4444';
      const x = toX(i);
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyBot = toY(Math.min(c.open, c.close));
      const bodyH = Math.max(1, bodyBot - bodyTop);

      // Fitil
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Gövde
      ctx.fillStyle = color;
      ctx.fillRect(x - cw * 0.32, bodyTop, cw * 0.64, bodyH);

      // Hacim
      const vh = (c.volume / maxVol) * volH;
      ctx.fillStyle = bull ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)';
      ctx.fillRect(x - cw * 0.32, h - vh, cw * 0.64, vh);
    });

    // EMA overlay
    this._drawLine(ctx, ema(show.map((c) => c.close), 20), toX, toY, 'rgba(245,158,11,0.9)');
    this._drawLine(ctx, ema(show.map((c) => c.close), 50), toX, toY, 'rgba(139,92,246,0.9)');
  }

  _drawLine(ctx, values, toX, toY, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < values.length; i++) {
      if (values[i] === null || values[i] === undefined) { started = false; continue; }
      const x = toX(i), y = toY(values[i]);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  resize() { this.render(); }
}

export default ChartRenderer;
