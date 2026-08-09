/**
 * Bollinger Bands — Kaynak: UTC v2.0 §7.3
 * Upper = SMA + 2×STD, Middle = SMA, Lower = SMA - 2×STD
 */
import { sma } from './SMA.js';

export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const m = mid[i];
    const variance = slice.reduce((s, v) => s + (v - m) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = m + std * mult;
    lower[i] = m - std * mult;
  }
  return { upper, middle: mid, lower };
}

export default bollinger;
