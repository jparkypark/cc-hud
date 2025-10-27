/**
 * Segment registry and exports
 */

import type { SegmentConfig } from '../config';
import { Segment } from './base';
import { UsageSegment } from './usage';
import { DirectorySegment } from './directory';
import { GitSegment } from './git';

export * from './base';
export * from './usage';
export * from './directory';
export * from './git';

/**
 * Get segment class by type
 */
export function createSegment(config: SegmentConfig): Segment {
  switch (config.type) {
    case 'usage':
      return new UsageSegment(config);
    case 'directory':
      return new DirectorySegment(config);
    case 'git':
      return new GitSegment(config);
    default:
      // TypeScript should prevent this, but just in case
      throw new Error(`Unknown segment type: ${(config as any).type}`);
  }
}
