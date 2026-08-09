/**
 * SuperTrend — Kaynak: UTC v2.0 (SuperTrendStrategy §5.2)
 * ATR bazlı trend takip göstergesi.
 * temel: (H+L)/2 ± mult×ATR; trend flip koşulu fiyatın bandı kırması.
 */
import { atr } from './ATR.js';

export function superTrend(candles, period = 14, mult = 3.0) {
  const n = candles.length;
  const atrArr = atr(candles, period);
  const trend = new Array(n).fill(null);
  const sl = new Array(n).fill(null);

  const hl2 = candles.map((c) => (c.high + c.low) / 2);
  let upper = 0, lower = 0, prevUpper = 0, prevLower = 0, prevClose = 0;

  for (let i = 1; i < n; i++) {
    const a = atrArr[i] ?? atrArr[i - 1] ?? 0;
    const mid = hl2[i];
    const fu = mid + mult * a;
    const fl = mid - mult * a;

    upper = (fu < prevUpper || candles[i - 1].close > prevUpper) ? fu : prevUpper;
    lower = (fl > prevLower || candles[i - 1].close < prevLower) ? fl : prevLower;

    if (i === 1) {
      trend[i] = candles[i].close > upper ? 1 : -1;
    } else if (trend[i - 1] === 1) {
      trend[i] = candles[i].close < lower ? -1 : 1;
    } else {
      trend[i] = candles[i].close > upper ? 1 : -1;
    }

    sl[i] = trend[i] === 1 ? lower : upper;
    prevUpper = upper; prevLower = lower; prevClose = candles[i].close;
  }
  return { trend, stop: sl };
}

export default superTrend;
