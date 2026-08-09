/**
 * Utils — Ortak yardımcı fonksiyonlar (kaynak: BOZOK PRO §3 + UTC)
 */

export const now = () => Date.now();
export const nowTs = () => Date.now();

/** v'yi [min, max] aralığına sıkıştır */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Dizi medyanı (boş dizi → 0) */
export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Dizi ortalaması (boş dizi → 0) */
export const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/** Son n elemanın ortalaması */
export const lastMean = (arr, n) => mean(arr.slice(-n));

/** Standart sapma (popülasyon) */
export const stddev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
};

/**
 * Rolling regression eğimi (OLS, en küçük kareler)
 * xs = seviye index (1..N), ys = quantity
 * β₁ = Σ(xi-x̄)(yi-ȳ) / Σ(xi-x̄)²
 */
export const rollingSlope = (levels) => {
  if (!levels || levels.length < 2) return 0;
  const xs = levels.map((_, i) => i + 1);
  const ys = levels.map((x) => x.qty ?? x);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den ? num / den : 0;
};

/** Benzersiz ID üretimi: sig_<counter>_<ts> */
let _uidCounter = 0;
export const uid = (prefix = 'sig') =>
  `${prefix}_${Date.now()}_${(_uidCounter++ % 1000)}`;

/** Fiyat formatı: büyüklüğe göre ondalık */
export const fmtPrice = (p) => {
  if (!isFinite(p)) return '-';
  const abs = Math.abs(p);
  if (abs >= 1000) return p.toFixed(2);
  if (abs >= 1) return p.toFixed(3);
  if (abs >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
};

/** Miktar formatı */
export const fmtQty = (q) => {
  if (!isFinite(q)) return '-';
  if (q >= 1000) return q.toFixed(0);
  if (q >= 1) return q.toFixed(2);
  return q.toFixed(4);
};

/** Notional ($) formatı: 1.2M, 350K, 900 */
export const fmtNotional = (n) => {
  if (!isFinite(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
};

/** Yüzde formatı: +12.34% */
export const fmtPct = (p, digits = 2) => (p >= 0 ? '+' : '') + p.toFixed(digits) + '%';

/** ms → okunur süre */
export const fmtDuration = (ms) => {
  if (ms < 1000) return ms + 'ms';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  const m = Math.floor(s / 60);
  return m + 'm ' + Math.round(s % 60) + 's';
};

/** Sayıyı güvenli parse et */
export const num = (v) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
};

/** Diziyi max uzunlukta tut (bellek limiti) */
export const pushCap = (arr, item, cap) => {
  arr.push(item);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
};

/** rAF throttled helper */
export const throttle = (fn, ms) => {
  let last = 0;
  return (...args) => {
    const t = now();
    if (t - last >= ms) {
      last = t;
      fn(...args);
    }
  };
};

/** Debounce helper */
export const debounce = (fn, ms) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export default {
  now, nowTs, clamp, median, mean, lastMean, stddev, rollingSlope, uid,
  fmtPrice, fmtQty, fmtNotional, fmtPct, fmtDuration, num, pushCap, throttle, debounce
};
