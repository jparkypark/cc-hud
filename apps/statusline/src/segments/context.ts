/**
 * Context window segment - displays context window usage percentage
 */

import type { ClaudeCodeInput, ContextSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';

export class ContextSegment extends Segment {
  protected config: ContextSegmentConfig;

  constructor(config: ContextSegmentConfig) {
    super(config);
    this.config = config;
  }

  render(input: ClaudeCodeInput, _db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;
    const contextWindow = input.context_window;

    // If no context window data available, return empty
    if (!contextWindow) {
      return {
        text: '',
        colors,
      };
    }

    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('◧');  // Context/window icon
    }

    const used = contextWindow.used_percentage;
    const remaining = contextWindow.remaining_percentage;

    // Format based on display mode
    if (display.mode === 'used' && used !== undefined) {
      parts.push(`${Math.round(used)}%`);
    } else if (display.mode === 'remaining' && remaining !== undefined) {
      parts.push(`${Math.round(remaining)}%`);
    } else if (display.mode === 'both') {
      if (used !== undefined && remaining !== undefined) {
        parts.push(`${Math.round(used)}%/${Math.round(remaining)}%`);
      } else if (used !== undefined) {
        parts.push(`${Math.round(used)}%`);
      } else if (remaining !== undefined) {
        parts.push(`${Math.round(remaining)}%`);
      }
    }

    // If we only have icon and no data, return empty
    if (parts.length === 0 || (parts.length === 1 && display.icon)) {
      return {
        text: '',
        colors,
      };
    }

    return {
      text: parts.join(' '),
      colors,
    };
  }
}
