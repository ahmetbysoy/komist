/**
 * ATR — Average True Range (Wilder)
 * Kaynak: UTC v2.0 §7.2
 * TR = max(H-L, |H-prevC|, |L-prevC|); Wilder smoothing sonrası
 */
export function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;

  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - p.close),
      Math.abs(c.low - p.close)
    );
    trs.push(tr);
  }

  let a = trs.slice(0, period).reduce((s, t) => s + t, 0) / period;
  out[period] = a;
  for (let i = period; i < trs.length; i++) {
    a = (a * (period - 1) + trs[i]) / period;
    out[i + 1] = a;
  }
  return out;
}

export default atr;
