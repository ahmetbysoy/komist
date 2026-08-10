/**
 * Utils — Ortak yardımcılar (barva35.html referansı)
 */

export const now = () => Date.now();
export const nowTs = () => Date.now();

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export const stddev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
};

/** Fiyat formatı — büyüklüğe göre dinamik ondalık (barva35 formatPrice) */
export function formatPrice(price) {
  if (!isFinite(price)) return '-';
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toFixed(2);
  if (abs >= 1) return price.toFixed(2);
  if (abs >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

/** Hacim formatı (barva35 formatVolume) */
export function formatVolume(v) {
  if (!isFinite(v)) return '-';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

/** Sembole göre dinamik ondalık basamak sayısı (barva35 getDecimalPlaces) */
export function getDecimalPlaces(symbol) {
  const s = (symbol || '').toUpperCase();
  if (s.includes('1000')) return 2;
  if (s.includes('BTC')) return 1;
  if (s.includes('USDT') || s.includes('USDC')) return 2;
  return 2;
}

/** Benzersiz ID */
let _uid = 0;
export const uid = (prefix = 'sig') => `${prefix}_${Date.now()}_${_uid++}`;

export const pushCap = (arr, item, cap) => {
  arr.push(item);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
};

export const debounce = (fn, ms) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export default {
  now, nowTs, clamp, median, mean, stddev,
  formatPrice, formatVolume, getDecimalPlaces, uid, pushCap, debounce
};
