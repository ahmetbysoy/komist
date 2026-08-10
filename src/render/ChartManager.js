/**
 * ChartManager — Mum grafiği (Lightweight Charts v3.8 — npm, offline)
 * Kaynak: barva35.html (ChartManager)
 * Seriler: candlestick, volume histogram, BB üst/orta/alt.
 * Marker: TP ▲ yeşil, SL ▼ kırmızı.
 */
import { createChart } from 'lightweight-charts';
import { bollinger } from '../indicators/Bollinger.js';

export class ChartManager {
  constructor(containerId = 'live-chart') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.chart = createChart(this.container, this._getChartOptions());
    this.series = {};
    this.series.candles = this.chart.addCandlestickSeries(this._getCandlestickOptions());
    this.series.volume = this.chart.addHistogramSeries({
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      scaleMargins: { top: 0.8, bottom: 0 }
    });
    this.series.bbUpper = this.chart.addLineSeries({ color: 'rgba(255,255,0,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    this.series.bbMiddle = this.chart.addLineSeries({ color: 'rgba(255,255,0,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    this.series.bbLower = this.chart.addLineSeries({ color: 'rgba(255,255,0,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  }

  _getChartOptions() {
    const styles = getComputedStyle(document.documentElement);
    const border = styles.getPropertyValue('--border-color').trim() || '#30363d';
    return {
      layout: {
        backgroundColor: 'transparent',
        textColor: styles.getPropertyValue('--text-main').trim() || '#c9d1d9',
        fontFamily: "'Roboto Mono', monospace"
      },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border }
      },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, rightOffset: 10 },
      rightPriceScale: { borderColor: border },
      crosshair: { mode: 0 }
    };
  }

  _getCandlestickOptions() {
    const styles = getComputedStyle(document.documentElement);
    return {
      upColor: styles.getPropertyValue('--positive').trim() || '#28a745',
      downColor: styles.getPropertyValue('--negative').trim() || '#dc3545',
      borderUpColor: styles.getPropertyValue('--positive').trim() || '#28a745',
      borderDownColor: styles.getPropertyValue('--negative').trim() || '#dc3545',
      wickUpColor: styles.getPropertyValue('--positive').trim() || '#28a745',
      wickDownColor: styles.getPropertyValue('--negative').trim() || '#dc3545'
    };
  }

  /** 500 mum yükle (barva35 setData) */
  setData(candles) {
    if (!candles?.length) return;
    const candleData = candles.map((c) => ({
      time: Math.floor(c.time / 1000),
      open: c.open, high: c.high, low: c.low, close: c.close
    }));
    const volumeData = candles.map((c) => ({
      time: Math.floor(c.time / 1000),
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(40,167,69,0.5)' : 'rgba(220,53,69,0.5)'
    }));
    this.series.candles.setData(candleData);
    this.series.volume.setData(volumeData);
    this._drawBollingerBands(candles);
    this.chart.timeScale().fitContent();
  }

  /** Anlık mum güncelleme (barva35 updateRealtime) */
  updateRealtime(kline) {
    const t = Math.floor(kline.t / 1000);
    const candle = { time: t, open: +kline.o, high: +kline.h, low: +kline.l, close: +kline.c };
    const vol = { time: t, value: +kline.v, color: kline.c >= kline.o ? 'rgba(40,167,69,0.5)' : 'rgba(220,53,69,0.5)' };
    this.series.candles.update(candle);
    this.series.volume.update(vol);
    if (kline.x) this._drawBollingerBandsFromSeries();
  }

  _drawBollingerBands(candles) {
    const closes = candles.map((c) => c.close);
    const bb = bollinger(closes, 20);
    const t = (i) => Math.floor(candles[i].time / 1000);
    const map = (arr) => arr.map((v, i) => (v === null || v === undefined ? null : { time: t(i), value: v }))
      .filter((x) => x !== null);
    this.series.bbUpper.setData(map(bb.upper));
    this.series.bbMiddle.setData(map(bb.middle));
    this.series.bbLower.setData(map(bb.lower));
  }

  _drawBollingerBandsFromSeries() {
    // Son 50 mumdan BB yeniden çiz (kapanış sonrası)
    const data = this.series.candles.data().slice(-50);
    if (data.length < 20) return;
    const closes = data.map((c) => c.close);
    const bb = bollinger(closes, 20);
    const mk = (arr) => arr.map((v, i) => (v == null ? null : { time: data[i].time, value: v })).filter(Boolean);
    this.series.bbUpper.setData(mk(bb.upper));
    this.series.bbMiddle.setData(mk(bb.middle));
    this.series.bbLower.setData(mk(bb.lower));
  }

  /** Sinyal marker'ı (barva35 addSignalMarker) */
  addSignalMarker(signal) {
    const time = Math.floor((signal.timestamp || Date.now()) / 1000);
    const isBuy = signal.direction === 'buy';
    this.series.candles.setMarkers([
      {
        time,
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#28a745' : '#dc3545',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: isBuy ? 'TP ▲' : 'SL ▼'
      }
    ]);
  }

  clearMarkers() {
    this.series.candles.setMarkers([]);
  }

  zoomIn() { this.chart.timeScale().zoom(1.2); }
  zoomOut() { this.chart.timeScale().zoom(0.8); }
  resetZoom() { this.chart.timeScale().fitContent(); }
  updateTheme() { this.chart.applyOptions(this._getChartOptions()); }
  resize() { this.chart.applyOptions({ width: this.container.clientWidth, height: this.container.clientHeight }); }
}

export default ChartManager;
