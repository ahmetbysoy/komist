/**
 * RSI — Relative Strength Index (Wilder smoothing)
 * Kaynak: UTC v2.0 §7.1
 * RSI = 100 - 100/(1+RS); RS = avgGain/avgLoss
 */
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = _rsValue(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = _rsValue(avgGain, avgLoss);
  }
  return out;
}

function _rsValue(avgGain, avgLoss) {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export default rsi;
