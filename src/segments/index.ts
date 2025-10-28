/**
 * Segment registry and exports
 */

import type { SegmentConfig } from '../config';
import { Segment } from './base';
import { UsageSegment } from './usage';
import { BurnRateSegment } from './burnrate';
import { DirectorySegment } from './directory';
import { GitSegment } from './git';
import { ThoughtsSegment } from './thoughts';

export * from './base';
export * from './usage';
export * from './burnrate';
export * from './directory';
export * from './git';
export * from './thoughts';

/**
 * Get segment class by type
 */
export function createSegment(config: SegmentConfig): Segment {
  switch (config.type) {
    case 'usage':
      return new UsageSegment(config);
    case 'burnrate':
      return new BurnRateSegment(config);
    case 'directory':
      return new DirectorySegment(config);
    case 'git':
      return new GitSegment(config);
    case 'thoughts':
      return new ThoughtsSegment(config);
    default:
      // TypeScript should prevent this, but just in case
      throw new Error(`Unknown segment type: ${(config as any).type}`);
  }
}
