/**
 * CvdEquityRenderer — CVD + Equity çizgi grafikleri
 * Kaynak: BOZOK PRO §10 (CVD, Equity)
 * kind: 'cvd' → cvdHistory son 50; 'equity' → performance.equity + gradient fill
 */
import { STATE } from '../core/State.js';

export class CvdEquityRenderer {
  constructor(canvas, bus, kind = 'cvd') {
    this.canvas = canvas;
    this.bus = bus;
    this.kind = kind;
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

    const data = this.kind === 'cvd'
      ? STATE.cvdHistory.slice(-50).map((d) => d.value)
      : STATE.performance.equity;
    if (data.length < 2) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '12px monospace';
      ctx.fillText(this.kind === 'cvd' ? 'CVD verisi bekleniyor...' : 'Equity verisi bekleniyor...', 12, h / 2);
      return;
    }

    const minV = Math.min(...data);
    const maxV = Math.max(...data);
    const range = maxV - minV || 1;

    const x = (i) => (i / (data.length - 1)) * w;
    const y = (v) => h - ((v - minV) / range) * (h - 20) - 10;

    const color = this.kind === 'cvd'
      ? (STATE.cvd >= 0 ? '#10b981' : '#ef4444')
      : '#3b82f6';

    // Çizgi
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((v, i) => {
      if (i === 0) ctx.moveTo(x(i), y(v));
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();

    // Equity: gradient dolgu
    if (this.kind === 'equity') {
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(59,130,246,.2)');
      g.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  resize() { this.render(); }
}

export default CvdEquityRenderer;
