/**
 * EMA — Exponential Moving Average
 * Kaynak: UTC v2.0 §7.5
 * k = 2/(period+1); EMA[i] = price×k + EMA[i-1]×(1-k)
 */
export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed: ilk period'un SMA'sı
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export default ema;
