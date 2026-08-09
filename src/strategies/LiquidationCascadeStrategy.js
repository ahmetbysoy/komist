/**
 * LiquidationCascadeStrategy — Likidasyon kaskadı
 * Kaynak: UTC v2.0 §5.2
 * 1 saniyelik hacim > 15× ortalama saniye hacmi → kaskad;
 * son trade yönünün tersine işlem (stop avı bittiğinde dönüş).
 */
import { Strategy } from './Strategy.js';

export class LiquidationCascadeStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'liquidationCascade', 'uriel', 'courage');
    this.SPIKE_MULT = 15;
    this.secVolumes = [];
    this.currentSec = 0;
    this.currentVol = 0;
  }

  processTrade(trade) {
    const ts = Date.now();
    const sec = Math.floor(ts / 1000);
    if (sec !== this.currentSec) {
      this.secVolumes.push(this.currentVol);
      if (this.secVolumes.length > 30) this.secVolumes.shift();
      this.currentSec = sec;
      this.currentVol = 0;
    }
    this.currentVol += trade.notional;

    if (this.secVolumes.length >= 5) {
      const avg = this.secVolumes.reduce((a, b) => a + b, 0) / this.secVolumes.length;
      if (this.currentVol > avg * this.SPIKE_MULT && avg > 0) {
        // Son trade yönünün tersine (kaskad sonrası dönüş)
        this.propose(this.bot.marketData.symbol,
          trade.side === 'buy' ? 'sell' : 'buy',
          `Likidasyon kaskadı: ${(this.currentVol / 1e6).toFixed(1)}M$/sn`, 6);
      }
    }
  }
}

export default LiquidationCascadeStrategy;
