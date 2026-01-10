/**
 * Git segment - displays git branch and status
 */

import type { ClaudeCodeInput, GitSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { getGitInfoSync, type GitInfo } from './git-utils';

// Cache TTL in milliseconds (2 seconds - git state doesn't change that fast)
const CACHE_TTL_MS = 2000;

interface GitCache {
  data: GitInfo | null;
  cwd: string;
  timestamp: number;
}

export class GitSegment extends Segment {
  protected config: GitSegmentConfig;
  private cache: GitCache | null = null;

  constructor(config: GitSegmentConfig) {
    super(config);
    this.config = config;
  }

  /**
   * Get git info with caching to avoid multiple git commands per render
   */
  private getGitInfoCached(cwd: string): GitInfo | null {
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
    const data = getGitInfoSync(cwd);
    this.cache = { data, cwd, timestamp: now };
    return data;
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Get current working directory
    const cwd = input.cwd || process.cwd();

    // Fetch git information with caching
    const git = this.getGitInfoCached(cwd);

    // If no git data or no branch, return empty segment
    if (!git || !git.branch) {
      return {
        text: '',
        colors,
      };
    }

    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('⎇');  // Branch symbol
    }

    // Branch name
    if (display.branch) {
      parts.push(git.branch);
    }

    // Dirty indicator
    if (display.status && git.isDirty) {
      parts.push('✗');
    }

    // Ahead count
    if (display.ahead && git.ahead && git.ahead > 0) {
      parts.push(`↑${git.ahead}`);
    }

    // Behind count
    if (display.behind && git.behind && git.behind > 0) {
      parts.push(`↓${git.behind}`);
    }

    return {
      text: parts.join(' '),
      colors,
    };
  }
}
