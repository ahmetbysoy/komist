/**
 * RsiDivergenceStrategy — RSI uyuşmazlığı (divergence)
 * Kaynak: UTC v2.0 §5.1
 * Fiyat higher high yaparken RSI lower high → bearish divergence → SATIŞ
 * Fiyat lower low yaparken RSI higher low → bullish divergence → ALIŞ
 */
import { Strategy } from './Strategy.js';
import { rsi } from '../indicators/RSI.js';

export class RsiDivergenceStrategy extends Strategy {
  constructor(bot) {
    super(bot, 'rsiDivergence', 'metatron', 'wisdom');
    this.RSI_PERIOD = 14;
    this.LOOKBACK = 10;
  }

  periodicAnalyze() {
    const candles = this.bot.candles;
    if (!candles || candles.length < this.RSI_PERIOD + this.LOOKBACK + 2) return;

    const prices = candles.map((c) => c.close);
    const rsiArr = rsi(prices, this.RSI_PERIOD);

    const start = candles.length - this.LOOKBACK;
    const slice = candles.slice(start);
    const rsiSlice = rsiArr.slice(start);

    // Pivot arama
    let hh1 = null, hh2 = null, ll1 = null, ll2 = null;
    for (let i = 2; i < slice.length - 2; i++) {
      if (slice[i].high > slice[i - 1].high && slice[i].high > slice[i - 2].high &&
          slice[i].high > slice[i + 1].high && slice[i].high > slice[i + 2].high) {
        if (!hh1) hh1 = { price: slice[i].high, rsi: rsiSlice[i] };
        else hh2 = { price: slice[i].high, rsi: rsiSlice[i] };
      }
      if (slice[i].low < slice[i - 1].low && slice[i].low < slice[i - 2].low &&
          slice[i].low < slice[i + 1].low && slice[i].low < slice[i + 2].low) {
        if (!ll1) ll1 = { price: slice[i].low, rsi: rsiSlice[i] };
        else ll2 = { price: slice[i].low, rsi: rsiSlice[i] };
      }
    }

    // Bearish: fiyat HH↑, RSI HH↓
    if (hh1 && hh2 && hh2.price > hh1.price && hh2.rsi < hh1.rsi && hh2.rsi < 70) {
      this.propose(this.bot.marketData.symbol, 'sell',
        'RSI Bearish Divergence: fiyat HH yaparken RSI düşüyor', 5);
    }
    // Bullish: fiyat LL↓, RSI LL↑
    if (ll1 && ll2 && ll2.price < ll1.price && ll2.rsi > ll1.rsi && ll2.rsi > 30) {
      this.propose(this.bot.marketData.symbol, 'buy',
        'RSI Bullish Divergence: fiyat LL yaparken RSI yükseliyor', 5);
    }
  }
}

export default RsiDivergenceStrategy;
