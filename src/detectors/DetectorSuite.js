/**
 * DetectorSuite — 9 dedektörün orkestratörü
 * Kaynak: BOZOK PRO §7
 *
 * Her book:update event'inde çalışır, dedektör sırası:
 * Wall → Compression → Skew → Void → Ladder → Spoof → Iceberg → FlowPattern → LiqCluster
 */
import { WallDetector } from './WallDetector.js';
import { CompressionDetector } from './CompressionDetector.js';
import { SpoofingDetector } from './SpoofingDetector.js';
import { IcebergDetector } from './IcebergDetector.js';
import { LiquidityVoidDetector } from './LiquidityVoidDetector.js';
import { LadderDetector } from './LadderDetector.js';
import { BookSkewDetector } from './BookSkewDetector.js';
import { FlowPatternDetector } from './FlowPatternDetector.js';
import { LiquidationClusterDetector } from './LiquidationClusterDetector.js';

export class DetectorSuite {
  constructor(bus) {
    this.bus = bus;
    this.detectors = {
      wall: new WallDetector(bus),
      compression: new CompressionDetector(bus),
      skew: new BookSkewDetector(bus),
      void: new LiquidityVoidDetector(bus),
      ladder: new LadderDetector(bus),
      spoof: new SpoofingDetector(bus),
      iceberg: new IcebergDetector(bus),
      flowPattern: new FlowPatternDetector(bus),
      liqCluster: new LiquidationClusterDetector(bus)
    };
    this.tickCounter = 0;
  }

  /** book:update event'inde çağrılır */
  run() {
    this.tickCounter++;
    this.detectors.wall.detect();
    this.detectors.compression.detect();
    this.detectors.skew.detect();
    this.detectors.void.detect();
    this.detectors.ladder.detect();
    this.detectors.spoof.detect();
    this.detectors.iceberg.detect();
    // Flow pattern ve liq cluster her tick'te değil, 1s'de bir (maliyet)
    if (this.tickCounter % 4 === 0) {
      this.detectors.flowPattern.detect();
      this.detectors.liqCluster.detect();
    }
  }

  /** trade/liquidation event'lerinde de hafif tarama */
  onTrade() {
    this.detectors.iceberg.detect();
    if (this.tickCounter % 2 === 0) this.detectors.liqCluster.detect();
  }

  reset() {
    this.tickCounter = 0;
  }
}

export default DetectorSuite;
