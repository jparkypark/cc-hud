/**
 * PR segment - displays GitHub PR number for current branch
 */

import type { ClaudeCodeInput, PrSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { getPrInfoSync } from './pr-utils';

export class PrSegment extends Segment {
  protected config: PrSegmentConfig;

  constructor(config: PrSegmentConfig) {
    super(config);
    this.config = config;
  }

  render(input: ClaudeCodeInput, _db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Get current working directory
    const cwd = input.cwd || process.cwd();

    // Fetch PR information using gh CLI
    const pr = getPrInfoSync(cwd);

    // If no PR exists or PR is not open, show "no pr"
    if (!pr || pr.state !== 'OPEN') {
      const parts: string[] = [];
      if (display.icon) {
        parts.push('↑↰');
      }
      parts.push('no pr');
      return {
        text: parts.join(' '),
        colors,
      };
    }

    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('↑↰');  // PR icon
    }

    // PR number
    if (display.number) {
      parts.push(`#${pr.number}`);
    }

    return {
      text: parts.join(' '),
      colors,
    };
  }
}
