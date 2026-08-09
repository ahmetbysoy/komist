/**
 * BookRenderer — Order book canvas (bid/ask barları, VPVR, wall marker, plan çizgileri)
 * Kaynak: BOZOK PRO §10 (Order Book Render)
 */
import { STATE } from '../core/State.js';
import { clamp } from '../core/Utils.js';

export class BookRenderer {
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.bus = bus;
  }

  render() {
    const canvas = this.canvas;
    const rect = canvas.parentElement?.getBoundingClientRect?.();
    if (!rect || rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const book = STATE.book;
    const bids = book.bids || [], asks = book.asks || [];
    if (!bids.length || !asks.length) return;

    const minPrice = asks[asks.length - 1]?.price ?? bids[0].price;
    const maxPrice = bids[0]?.price ?? asks[0].price;
    const range = maxPrice - minPrice || 1;
    const maxQty = Math.max(
      ...bids.slice(0, 20).map((b) => b.qty),
      ...asks.slice(0, 20).map((a) => a.qty),
      1
    );

    const midX = W * 0.5;
    const barW = W * 0.35;
    const y = (price) => (1 - (price - minPrice) / range) * H;

    // VPVR heatmap (aktif katman: vpvr)
    if (STATE.activeLayers.includes('vpvr')) this._drawHeatmap(ctx, W, H, y);

    // Ask barları (soldan sağa orta hatta doğru)
    ctx.fillStyle = 'rgba(239,68,68,0.55)';
    for (const lv of asks.slice(0, 20)) {
      const bw = (lv.qty / maxQty) * barW;
      const yy = y(lv.price);
      ctx.fillRect(midX, yy - 1, bw, Math.max(2, H / 40 - 1));
    }
    // Bid barları (sağdan sola orta hatta doğru)
    ctx.fillStyle = 'rgba(16,185,129,0.55)';
    for (const lv of bids.slice(0, 20)) {
      const bw = (lv.qty / maxQty) * barW;
      const yy = y(lv.price);
      ctx.fillRect(midX - bw, yy - 1, bw, Math.max(2, H / 40 - 1));
    }

    // Mid price line
    if (STATE.micro?.mid) {
      ctx.strokeStyle = 'rgba(245,158,11,0.9)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y(STATE.micro.mid));
      ctx.lineTo(W, y(STATE.micro.mid));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Trade plan çizgileri
    const plan = STATE.tradePlan;
    if (plan && plan.direction !== 'NEUTRAL') {
      this._drawPlanLine(ctx, W, y, plan.entry, 'rgba(59,130,246,0.9)');
      this._drawPlanLine(ctx, W, y, plan.stop, 'rgba(239,68,68,0.9)');
      this._drawPlanLine(ctx, W, y, plan.tp1, 'rgba(16,185,129,0.9)');
    }

    // Wall markers
    if (STATE.activeLayers.includes('walls')) {
      ctx.fillStyle = '#f59e0b';
      for (const wl of STATE.detectorState.walls.bid) {
        ctx.fillRect(0, y(wl.price) - 3, 8, 6);
      }
      for (const wl of STATE.detectorState.walls.ask) {
        ctx.fillRect(W - 8, y(wl.price) - 3, 8, 6);
      }
    }
  }

  _drawHeatmap(ctx, W, H, y) {
    const history = STATE.heatHistory.slice(-20);
    if (!history.length) return;
    // Fiyat → y koordinatı çakışması: heatmap'i kendi fiyat aralığına göre çiz
    for (const frame of history) {
      const maxQ = Math.max(...frame.bids.map((b) => b.qty), ...frame.asks.map((a) => a.qty), 1);
      for (const lv of frame.bids) {
        const alpha = clamp(lv.qty / maxQ, 0, 1) * 0.22;
        ctx.fillStyle = `rgba(59,130,246,${alpha})`;
        ctx.fillRect(0, y(lv.price) - 1, W * 0.5, 2);
      }
      for (const lv of frame.asks) {
        const alpha = clamp(lv.qty / maxQ, 0, 1) * 0.22;
        ctx.fillStyle = `rgba(59,130,246,${alpha})`;
        ctx.fillRect(W * 0.5, y(lv.price) - 1, W * 0.5, 2);
      }
    }
  }

  _drawPlanLine(ctx, W, y, price, color) {
    if (!price) return;
    const yy = y(price);
    if (yy < 0 || yy > W * 0) return;
    ctx.strokeStyle = color;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  resize() {
    this.render();
  }
}

export default BookRenderer;
