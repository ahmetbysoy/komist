/**
 * HeatmapManager — Emir defteri ısı haritası (barva35.html referansı)
 * Asks üst yarı, bids alt yarı. intensity = sqrt(qty/maxQty).
 * Etiket: "qty @ price" — yoğunlukta beyaz, düşükte gri.
 */
export class HeatmapManager {
  constructor(canvasId = 'orderbook-heatmap') {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas?.getContext('2d');
    this._resizeCanvas();
  }

  _resizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
  }

  /**
   * @param {Object} orderBook { bids: [price,qty][], asks: [price,qty][] }
   * @param {number} symbolPrice
   */
  draw(orderBook, symbolPrice) {
    if (!this.ctx) return;
    const size = this._resizeCanvas();
    if (!size) return;
    this.ctx.clearRect(0, 0, size.w, size.h);

    if (!orderBook?.bids?.length || !orderBook?.asks?.length) return;

    const asks = orderBook.asks.slice().reverse();
    const bids = orderBook.bids;
    const allLevels = [...bids, ...asks];
    const maxQty = Math.max(...allLevels.map((l) => l[1]));

    this._drawSection(asks, 'asks', maxQty, size, symbolPrice);
    this._drawSection(bids, 'bids', maxQty, size, symbolPrice);
  }

  _drawSection(levels, side, maxQty, size, symbolPrice) {
    const { w, h } = size;
    const half = h / 2;
    const heightPerLevel = half / Math.max(levels.length, 1);
    const baseColor = side === 'asks' ? '239,68,68' : '40,167,69';
    const decimals = this._getDecimals(symbolPrice);

    levels.forEach(([price, qty], i) => {
      const intensity = Math.min(Math.sqrt(qty / maxQty), 1.0);
      const barWidth = w * intensity;
      const y = side === 'asks' ? i * heightPerLevel : half + i * heightPerLevel;

      this.ctx.fillStyle = `rgba(${baseColor}, ${(intensity * 0.6 + 0.1).toFixed(2)})`;
      this.ctx.fillRect(0, y, barWidth, heightPerLevel);

      // Etiket
      this.ctx.fillStyle = intensity > 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(200,200,200,0.75)';
      this.ctx.font = '10px "Roboto Mono", monospace';
      this.ctx.fillText(`${qty.toFixed(4)} @ ${price.toFixed(decimals)}`, 6, y + heightPerLevel / 2 + 3);
    });

    // Merkez fiyat çizgisi
    if (symbolPrice) {
      this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, half);
      this.ctx.lineTo(w, half);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  _getDecimals(price) {
    if (!isFinite(price)) return 2;
    const abs = Math.abs(price);
    if (abs > 1000) return 2;
    if (abs > 1) return 3;
    if (abs > 0.01) return 4;
    return 6;
  }

  resize() {
    this._resizeCanvas();
  }
}

export default HeatmapManager;
