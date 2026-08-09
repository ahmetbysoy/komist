/**
 * ADX — Average Directional Index (Wilder)
 * Kaynak: UTC v2.0 §7.4
 * +DI/-DI hesaplanır; DX = 100×|+DI - -DI|/(+DI + -DI); ADX = smoothed DX
 */
export function adx(candles, period = 14) {
  const n = candles.length;
  const out = new Array(n).fill(null);
  if (n < period * 2) return out;

  const trArr = [], pdm = [], ndm = [];
  for (let i = 1; i < n; i++) {
    const c = candles[i], p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    trArr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    pdm.push((up > down && up > 0) ? up : 0);
    ndm.push((down > up && down > 0) ? down : 0);
  }

  // Wilder smoothing
  let sTR = trArr.slice(0, period).reduce((s, v) => s + v, 0);
  let sPDM = pdm.slice(0, period).reduce((s, v) => s + v, 0);
  let sNDM = ndm.slice(0, period).reduce((s, v) => s + v, 0);

  const dxs = [];
  for (let i = period; i < trArr.length; i++) {
    sTR = sTR - (sTR / period) + trArr[i];
    sPDM = sPDM - (sPDM / period) + pdm[i];
    sNDM = sNDM - (sNDM / period) + ndm[i];

    const pDI = 100 * (sPDM / sTR);
    const nDI = 100 * (sNDM / sTR);
    const sum = pDI + nDI;
    dxs.push(sum > 0 ? 100 * Math.abs(pDI - nDI) / sum : 0);
  }

  // ADX = smoothed DX
  let adxVal = dxs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period * 2] = adxVal;
  for (let i = period; i < dxs.length; i++) {
    adxVal = (adxVal * (period - 1) + dxs[i]) / period;
    out[i + period + 1] = adxVal;
  }
  return out;
}

export default adx;
