/**
 * Burn rate segment - displays hourly cost burn rate
 */

import type { ClaudeCodeInput, BurnRateSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { calculateHourlyBurnRate } from '../usage/hourly-calculator';

export class BurnRateSegment extends Segment {
  protected config: BurnRateSegmentConfig;
  private cachedBurnRate: number | null = null;

  constructor(config: BurnRateSegmentConfig) {
    super(config);
    this.config = config;
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('△');  // Alchemical symbol for fire
    }

    // Add burn rate
    const burnRate = this.cachedBurnRate || 0;
    parts.push(`$${burnRate.toFixed(2)}/hr`);

    return {
      text: parts.join(' '),
      colors,
    };
  }

  /**
   * Update cached burn rate (call this before render)
   */
  async updateCache(): Promise<void> {
    const hourlyUsage = await calculateHourlyBurnRate();
    this.cachedBurnRate = hourlyUsage.cost;
  }
}
