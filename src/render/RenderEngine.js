/**
 * RenderEngine — Canvas orkestratör (DPR-aware)
 * Kaynak: BOZOK PRO §10
 * Aktif sekme render edilir; rAF ile 100ms throttle.
 */
import { STATE } from '../core/State.js';
import { throttle } from '../core/Utils.js';
import { BookRenderer } from './BookRenderer.js';
import { FlowRenderer } from './FlowRenderer.js';
import { CvdEquityRenderer } from './CvdEquityRenderer.js';

export class RenderEngine {
  constructor(bus) {
    this.bus = bus;
    this.canvases = {};
    this.renderers = {};
    this.rafId = null;
    this.lastRender = 0;
    this.MIN_INTERVAL = 100;
  }

  /** Canvas kayıt: id → { canvas, kind } kind: book|flow|cvd|equity|chart */
  registerCanvas(id, kind) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    this.canvases[id] = canvas;
    switch (kind) {
      case 'book': this.renderers[id] = new BookRenderer(canvas, this.bus); break;
      case 'flow': this.renderers[id] = new FlowRenderer(canvas, this.bus); break;
      case 'cvd':
      case 'equity': this.renderers[id] = new CvdEquityRenderer(canvas, this.bus, kind); break;
      default: this.renderers[id] = null;
    }
    return this.renderers[id];
  }

  /** DPR-bilinçli boyutlandırma (tüm renderer'lar ortak) */
  resizeCanvas(canvas) {
    const rect = canvas.parentElement?.getBoundingClientRect?.();
    if (!rect || rect.width === 0) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  /** Aktif sekmeye göre render */
  renderAll(force = false) {
    const nowTs = Date.now();
    if (!force && nowTs - this.lastRender < this.MIN_INTERVAL) return;
    this.lastRender = nowTs;

    const tab = STATE.activeTab;
    const mapping = {
      book: ['book-canvas'],
      flow: ['flow-canvas'],
      depth: ['cvd-canvas', 'equity-canvas'],
      perf: ['equity-canvas']
    };
    const ids = mapping[tab] || [];
    for (const id of ids) {
      this.renderers[id]?.render?.();
    }
  }

  /** rAF döngüsü */
  startLoop() {
    const loop = () => {
      this.renderAll();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** Pencere boyutu değişiminde tüm canvas'ları yeniden ölç */
  handleResize() {
    for (const id of Object.keys(this.canvases)) {
      this.renderers[id]?.resize?.();
    }
    this.renderAll(true);
  }
}

export default RenderEngine;
