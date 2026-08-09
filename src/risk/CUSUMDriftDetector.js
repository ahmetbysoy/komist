/**
 * CUSUMDriftDetector — Drift dedektörü (strateji performans izleme)
 * Kaynak: UTC v2.0 §4.12
 *
 * Cp = max(0, Cp + (Xn - K)); Cn = max(0, Cn + ((1-Xn) - K))
 * Cn > H → kötü drift (strateji bozuldu)
 */
export class CUSUMDriftDetector {
  constructor(K = 0.5, H = 3.0) {
    this.K = K;
    this.H = H;
    this.Cp = 0;
    this.Cn = 0;
  }

  /**
   * @param {boolean} isWin
   * @returns {boolean} true → kötü drift tespit edildi
   */
  update(isWin) {
    const Xn = isWin ? 1 : 0;
    this.Cp = Math.max(0, this.Cp + (Xn - this.K));
    this.Cn = Math.max(0, this.Cn + ((1 - Xn) - this.K));

    if (this.Cp > this.H) { this.Cp = 0; return false; }  // iyi drift, reset
    if (this.Cn > this.H) { this.Cn = 0; return true; }   // kötü drift!
    return false;
  }

  reset() {
    this.Cp = 0;
    this.Cn = 0;
  }
}

export default CUSUMDriftDetector;
