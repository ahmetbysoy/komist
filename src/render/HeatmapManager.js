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
    // tickSize hassasiyeti ile ondalık hesaplama
    let decimals = this._getDecimals(symbolPrice);
    try {
      const tickSize = (typeof STATE !== 'undefined' && STATE.symbolInfo?.tickSize) || null;
      if (tickSize) {
        const s = tickSize.toString();
        if (s.includes('e-')) decimals = parseInt(s.split('e-')[1]);
        else if (s.includes('.')) decimals = s.split('.')[1].replace(/0+$/, '').length || decimals;
      }
    } catch(_){}

    levels.forEach(([price, qty], i) => {
      const intensity = Math.min(Math.pow(qty / maxQty, 0.7), 1.0);
      const barWidth = w * intensity;
      const y = side === 'asks' ? i * heightPerLevel : half + i * heightPerLevel;

      // Premium gradient: daha akıcı renk geçişi
      const alpha = (intensity * 0.7 + 0.15).toFixed(2);
      const gradient = this.ctx.createLinearGradient(0, y, barWidth, y);
      gradient.addColorStop(0, `rgba(${baseColor}, ${alpha})`);
      gradient.addColorStop(1, `rgba(${baseColor}, ${(alpha*0.6).toFixed(2)})`);
      this.ctx.fillStyle = gradient;
      // Yuvarlatılmış bar
      this.ctx.beginPath();
      this.ctx.roundRect(0, y+1, barWidth, heightPerLevel-2, 2);
      this.ctx.fill();

      // Etiket — yoğunluk ve mobil optimizasyon
      if (heightPerLevel > 8) {
        this.ctx.fillStyle = intensity > 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(220,220,220,0.85)';
        this.ctx.font = '10px "Roboto Mono", monospace';
        // Fiyat değişimini merkeze uzaklıkla renklendir (derinlik görünümü)
        const distFromMid = Math.abs(price - symbolPrice) / symbolPrice;
        if (distFromMid > 0.01) this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.ctx.fillText(`${qty.toFixed(3)} @ ${price.toFixed(decimals)}`, 8, y + heightPerLevel / 2 + 3);
      }
    });

    // Merkez fiyat çizgisi + fiyat etiketi
    if (symbolPrice) {
      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.setLineDash([4, 4]);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, half);
      this.ctx.lineTo(w, half);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      // Fiyat etiketi (premium)
      const priceText = symbolPrice.toFixed(decimals);
      this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
      this.ctx.fillRect(w - 70, half - 8, 70, 16);
      this.ctx.fillStyle = '#0d1117';
      this.ctx.font = 'bold 10px "Roboto Mono", monospace';
      this.ctx.fillText(priceText, w - 65, half + 3);
    }
    // Zaman ekseni işaretleyicileri (basit)
    this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.ctx.font = '8px "Roboto Mono", monospace';
    const now = new Date();
    this.ctx.fillText(now.toLocaleTimeString('tr-TR').slice(0,5), 4, h - 4);
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
