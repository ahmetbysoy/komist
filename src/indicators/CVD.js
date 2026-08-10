/**
 * CVD — Cumulative Volume Delta (Kümülatif Hacim Deltası)
 * Kaynak: Glass Engine / Pain Trend Indicator'den port (Faz D)
 * Her trade'in notional'ını alım (+), satım (-) yönünde toplar.
 * Divergence tespiti için fiyat ile CVD'nin zıt hareketi kontrol edilir.
 */

export class CVD {
  constructor(maxHistory = 500) {
    this.value = 0;
    this.history = []; // { ts, value, price }
    this.maxHistory = maxHistory;
  }

  /**
   * @param {Object} trade { price, quantity, notional, side: 'buy'|'sell', ts }
   * @returns {number} güncel CVD değeri
   */
  update(trade) {
    const notional = trade.notional ?? (trade.price * trade.quantity) ?? 0;
    const delta = trade.side === 'buy' ? notional : -notional;
    this.value += delta;
    const entry = {
      ts: trade.ts || Date.now(),
      value: this.value,
      price: trade.price,
      delta
    };
    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();
    return this.value;
  }

  getValue() {
    return this.value;
  }

  getHistory() {
    return this.history;
  }

  /**
   * Basit divergence tespiti: fiyat yükselirken CVD düşüyor / tersi
   * @param {number} lookback kaç bar geriye bakılacak
   * @returns {'bullish'|'bearish'|null}
   */
  detectDivergence(lookback = 20) {
    if (this.history.length < lookback * 2) return null;
    const recent = this.history.slice(-lookback);
    const prev = this.history.slice(-lookback * 2, -lookback);
    if (!recent.length || !prev.length) return null;

    const priceRecent = recent[recent.length - 1].price - recent[0].price;
    const pricePrev = prev[prev.length - 1].price - prev[0].price;
    const cvdRecent = recent[recent.length - 1].value - recent[0].value;
    const cvdPrev = prev[prev.length - 1].value - prev[0].value;

    // Fiyat yeni zirve yaparken CVD aşağıda → bearish divergence (satış)
    if (priceRecent > 0 && cvdRecent < 0 && priceRecent > pricePrev) return 'bearish';
    // Fiyat yeni dip yaparken CVD yukarıda → bullish divergence
    if (priceRecent < 0 && cvdRecent > 0 && Math.abs(priceRecent) > Math.abs(pricePrev)) return 'bullish';
    return null;
  }

  reset() {
    this.value = 0;
    this.history = [];
  }
}

/**
 * Saf fonksiyon: trade listesi üzerinden CVD hesapla
 * @param {Array} trades [{side, notional, price, quantity}]
 * @returns {number}
 */
export function calculateCVD(trades) {
  let c = 0;
  for (const t of trades) {
    const n = t.notional ?? (t.price * t.quantity) ?? 0;
    c += t.side === 'buy' ? n : -n;
  }
  return c;
}

/**
 * CVD delta oranı: belirli pencerede alım/satım notional oranı
 * OrderFlowMomentum'a yardımcı
 */
export function cvdDeltaRatio(trades) {
  let buy = 0, sell = 0;
  for (const t of trades) {
    const n = t.notional ?? (t.price * t.quantity) ?? 0;
    if (t.side === 'buy') buy += n;
    else sell += n;
  }
  const total = buy + sell;
  if (total === 0) return 0;
  return (buy - sell) / total; // -1 (full sell) .. +1 (full buy)
}

export default CVD;
