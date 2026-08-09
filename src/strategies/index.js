/**
 * strategies/index.js — Strateji registry
 * Kaynak: barva35.html (strategyAmbassadors + strategyGroups)
 *
 * Elçi atamaları:
 *  Metatron (bilgelik): mean reversion / destek-direnç
 *  Uriel (cesaret): momentum / breakout / kaskad
 *  Raphael (şifa): denge / risk
 *  Gabriel (iletişim): smart money / hacim
 *  Michael (savaş): agresif mum karakteri
 */
import { Strategy } from './Strategy.js';
import { WallBounceStrategy } from './WallBounceStrategy.js';
import { RsiDivergenceStrategy } from './RsiDivergenceStrategy.js';
import { SupportResistanceStrategy } from './SupportResistanceStrategy.js';
import { VWAPReversionStrategy } from './VWAPReversionStrategy.js';
import { FundingRateReversalStrategy } from './FundingRateReversalStrategy.js';
import { FibonacciRetracementStrategy } from './FibonacciRetracementStrategy.js';
import { DivergenceDetectionStrategy } from './DivergenceDetectionStrategy.js';
import { VelocityScalpingStrategy } from './VelocityScalpingStrategy.js';
import { BreakoutPatternStrategy } from './BreakoutPatternStrategy.js';
import { MarketStructureStrategy } from './MarketStructureStrategy.js';
import { VolatilityBreakoutStrategy } from './VolatilityBreakoutStrategy.js';
import { LiquidationCascadeStrategy } from './LiquidationCascadeStrategy.js';
import { OrderFlowMomentumStrategy } from './OrderFlowMomentumStrategy.js';
import { LiquidityGapsStrategy } from './LiquidityGapsStrategy.js';
import { MicroSpreadArbitrageStrategy } from './MicroSpreadArbitrageStrategy.js';
import { InstitutionalOrderFlowStrategy } from './InstitutionalOrderFlowStrategy.js';
import { VolumeProfileStrategy } from './VolumeProfileStrategy.js';
import { SmartMoneyConceptsStrategy } from './SmartMoneyConceptsStrategy.js';
import { SuperTrendStrategy } from './SuperTrendStrategy.js';
import { CandleCharacterStrategy } from './CandleCharacterStrategy.js';

export const STRATEGY_CLASSES = {
  wallBounce: WallBounceStrategy,
  velocityScalping: VelocityScalpingStrategy,
  rsiDivergence: RsiDivergenceStrategy,
  orderFlowMomentum: OrderFlowMomentumStrategy,
  liquidityGaps: LiquidityGapsStrategy,
  fibonacciRetracement: FibonacciRetracementStrategy,
  volumeProfile: VolumeProfileStrategy,
  smartMoneyConcepts: SmartMoneyConceptsStrategy,
  divergenceDetection: DivergenceDetectionStrategy,
  breakoutPattern: BreakoutPatternStrategy,
  supportResistance: SupportResistanceStrategy,
  marketStructure: MarketStructureStrategy,
  institutionalOrderFlow: InstitutionalOrderFlowStrategy,
  microSpreadArbitrage: MicroSpreadArbitrageStrategy,
  vwapReversion: VWAPReversionStrategy,
  superTrend: SuperTrendStrategy,
  volatilityBreakout: VolatilityBreakoutStrategy,
  candleCharacter: CandleCharacterStrategy,
  fundingRateReversal: FundingRateReversalStrategy,
  liquidationCascade: LiquidationCascadeStrategy
};

/** Elçi → strateji ataması (bilgi: panteon etkileşimi için) */
export const STRATEGY_AMBASSADORS = {
  wallBounce: { ambassador: 'metatron', category: 'wisdom' },
  rsiDivergence: { ambassador: 'metatron', category: 'wisdom' },
  supportResistance: { ambassador: 'metatron', category: 'wisdom' },
  vwapReversion: { ambassador: 'metatron', category: 'wisdom' },
  fundingRateReversal: { ambassador: 'metatron', category: 'wisdom' },
  fibonacciRetracement: { ambassador: 'metatron', category: 'wisdom' },
  divergenceDetection: { ambassador: 'metatron', category: 'wisdom' },

  velocityScalping: { ambassador: 'uriel', category: 'courage' },
  breakoutPattern: { ambassador: 'uriel', category: 'courage' },
  marketStructure: { ambassador: 'uriel', category: 'courage' },
  volatilityBreakout: { ambassador: 'uriel', category: 'courage' },
  liquidationCascade: { ambassador: 'uriel', category: 'courage' },
  orderFlowMomentum: { ambassador: 'uriel', category: 'courage' },

  liquidityGaps: { ambassador: 'raphael', category: 'healing' },
  microSpreadArbitrage: { ambassador: 'raphael', category: 'healing' },
  institutionalOrderFlow: { ambassador: 'raphael', category: 'healing' },

  volumeProfile: { ambassador: 'gabriel', category: 'communication' },
  smartMoneyConcepts: { ambassador: 'gabriel', category: 'communication' },
  superTrend: { ambassador: 'gabriel', category: 'communication' },

  candleCharacter: { ambassador: 'michael', category: 'warfare' }
};

/** Rejim bazlı strateji grupları (grup boost için) */
export const STRATEGY_GROUPS = {
  trending: ['breakoutPattern', 'orderFlowMomentum', 'marketStructure', 'volumeProfile',
             'smartMoneyConcepts', 'superTrend', 'volatilityBreakout', 'liquidationCascade'],
  meanReversion: ['vwapReversion', 'wallBounce', 'liquidityGaps', 'fibonacciRetracement',
                  'supportResistance', 'microSpreadArbitrage', 'divergenceDetection',
                  'rsiDivergence', 'institutionalOrderFlow', 'fundingRateReversal'],
  neutral: ['candleCharacter']
};

/** Strateji instancelarını oluşturur */
export function createStrategies(bot) {
  const instances = {};
  for (const [key, Cls] of Object.entries(STRATEGY_CLASSES)) {
    instances[key] = new Cls(bot);
  }
  return instances;
}

export { Strategy };
export default STRATEGY_CLASSES;
