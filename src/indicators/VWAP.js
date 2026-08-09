/**
 * VWAP — Volume Weighted Average Price (kümülatif)
 * Kaynak: UTC v2.0 §7.6
 * TP = (H+L+C)/3; VWAP = Σ(TP×V) / Σ(V)
 */
export function vwap(candles) {
  let cumPV = 0, cumV = 0;
  const out = [];
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = c.volume || 0;
    cumPV += tp * v;
    cumV += v;
    out.push(cumV > 0 ? cumPV / cumV : c.close);
  }
  return out;
}

export default vwap;
