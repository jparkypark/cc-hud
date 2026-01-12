/**
 * Base segment interface and types
 */

import type { SegmentConfig, ClaudeCodeInput } from '../config';
import type { DatabaseClient } from '../database';

/**
 * Rendered segment data (text + colors)
 */
export interface SegmentData {
  text: string;
  colors: {
    fg: string;
    bg: string;
  };
  allowWrap?: boolean;  // If true, allow internal word-wrap (default: false)
}

/**
 * Base abstract class for all segments
 */
export abstract class Segment {
  constructor(protected config: SegmentConfig) {}

  /**
   * Render the segment with the given input data and database
   */
  abstract render(
    input: ClaudeCodeInput,
    db: DatabaseClient
  ): SegmentData;
}
