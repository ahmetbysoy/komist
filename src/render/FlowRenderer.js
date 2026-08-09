/**
 * FlowRenderer — Flow candle canvas
 * Kaynak: BOZOK PRO §10 (Flow Candle Render)
 * Y ekseni pressure (-100..+100), nötr çizgi ortada.
 */
import { STATE } from '../core/State.js';

export class FlowRenderer {
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.bus = bus;
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

    const candles = STATE.flowCandles.slice(-40);
    if (candles.length < 2) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '12px monospace';
      ctx.fillText('Flow verisi bekleniyor...', 12, h / 2);
      return;
    }

    const midY = h / 2;
    const scale = (h / 2) - 10;
    const cw = w / candles.length;
    const toY = (p) => midY - (clampP(p) / 100) * scale;

    // Nötr çizgi
    ctx.strokeStyle = 'rgba(139,148,158,0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    let minP = 0, maxP = 0;
    for (const c of candles) {
      minP = Math.min(minP, c.pressureLow ?? c.pressureClose);
      maxP = Math.max(maxP, c.pressureHigh ?? c.pressureClose);
    }

    candles.forEach((c, i) => {
      const x = i * cw + cw / 2;
      const open = toY(c.pressureOpen ?? 0);
      const close = toY(c.pressureClose ?? 0);
      const high = toY(Math.max(maxP, c.pressureClose));
      const low = toY(Math.min(minP, c.pressureClose));
      const bull = (c.pressureClose ?? 0) >= (c.pressureOpen ?? 0);
      ctx.strokeStyle = bull ? '#10b981' : '#ef4444';
      ctx.fillStyle = bull ? '#10b981' : '#ef4444';

      // Fitil
      ctx.beginPath();
      ctx.moveTo(x, high);
      ctx.lineTo(x, low);
      ctx.stroke();

      // Gövde
      const bodyH = Math.max(1.5, Math.abs(close - open));
      ctx.fillRect(x - cw * 0.28, Math.min(open, close), cw * 0.56, bodyH);
    });
  }

  resize() { this.render(); }
}

const clampP = (p) => Math.max(-100, Math.min(100, p));

export default FlowRenderer;
