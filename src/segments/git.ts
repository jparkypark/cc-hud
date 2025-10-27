/**
 * Git segment - displays git branch and status
 */

import type { ClaudeCodeInput, GitSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { getGitInfoSync } from './git-utils';

export class GitSegment extends Segment {
  protected config: GitSegmentConfig;

  constructor(config: GitSegmentConfig) {
    super(config);
    this.config = config;
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Get current working directory
    const cwd = input.cwd || process.cwd();

    // Fetch git information by running git commands
    const git = getGitInfoSync(cwd);

    // If no git data or no branch, return empty segment
    if (!git || !git.branch) {
      return {
        text: '',
        colors,
      };
    }

    const parts: string[] = [];

    // Branch name with icon
    if (display.branch) {
      parts.push(` ${git.branch}`);  //  = Nerd Font git branch icon
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
