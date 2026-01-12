/**
 * PR segment - displays GitHub PR number for current branch
 */

import type { ClaudeCodeInput, PrSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { getPrInfoSync, type PrInfo } from './pr-utils';

// Cache TTL in milliseconds (30 seconds - PR state changes infrequently)
const CACHE_TTL_MS = 30000;

interface PrCache {
  data: PrInfo | null;
  cwd: string;
  timestamp: number;
}

export class PrSegment extends Segment {
  protected config: PrSegmentConfig;
  private cache: PrCache | null = null;

  constructor(config: PrSegmentConfig) {
    super(config);
    this.config = config;
  }

  /**
   * Get PR info with caching to avoid slow gh CLI calls
   */
  private getPrInfoCached(cwd: string): PrInfo | null {
    const now = Date.now();

    // Return cached data if valid (same cwd and not expired)
    if (
      this.cache &&
      this.cache.cwd === cwd &&
      now - this.cache.timestamp < CACHE_TTL_MS
    ) {
      return this.cache.data;
    }

    // Fetch fresh data and cache it
    const data = getPrInfoSync(cwd);
    this.cache = { data, cwd, timestamp: now };
    return data;
  }

  render(input: ClaudeCodeInput, _db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Get current working directory
    const cwd = input.cwd || process.cwd();

    // Fetch PR information with caching
    const pr = this.getPrInfoCached(cwd);

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
