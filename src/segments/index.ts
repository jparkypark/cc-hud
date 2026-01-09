/**
 * Segment registry and exports
 */

import type { SegmentConfig } from '../config';
import { Segment } from './base';
import { UsageSegment } from './usage';
import { PaceSegment } from './pace';
import { DirectorySegment } from './directory';
import { GitSegment } from './git';
import { ThoughtsSegment } from './thoughts';
import { PrSegment } from './pr';

export * from './base';
export * from './usage';
export * from './pace';
export * from './directory';
export * from './git';
export * from './thoughts';
export * from './pr';

/**
 * Get segment class by type
 */
export function createSegment(config: SegmentConfig): Segment {
  switch (config.type) {
    case 'usage':
      return new UsageSegment(config);
    case 'pace':
      return new PaceSegment(config);
    case 'directory':
      return new DirectorySegment(config);
    case 'git':
      return new GitSegment(config);
    case 'thoughts':
      return new ThoughtsSegment(config);
    case 'pr':
      return new PrSegment(config);
    default:
      // TypeScript should prevent this, but just in case
      throw new Error(`Unknown segment type: ${(config as any).type}`);
  }
}
