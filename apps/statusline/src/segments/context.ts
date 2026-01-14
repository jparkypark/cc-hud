/**
 * Context window segment - displays context window usage percentage
 */

import type { ClaudeCodeInput, ContextSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';

const FILLED = '▪';
const EMPTY = '▫';
const SEGMENTS = 5;

/**
 * Generate a gauge icon with 5 segments
 * Filled squares represent the percentage value
 */
function gaugeIcon(percentage: number): string {
  // 0-9% = 0, 10-29% = 1, 30-49% = 2, 50-69% = 3, 70-89% = 4, 90-100% = 5
  const filledCount = Math.round(percentage / 20);
  return FILLED.repeat(filledCount) + EMPTY.repeat(SEGMENTS - filledCount);
}

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

    // Default to 0% used / 100% remaining at session start
    const used = contextWindow.used_percentage ?? 0;
    const remaining = contextWindow.remaining_percentage ?? 100;

    // Add gauge icon - filled squares represent the displayed percentage
    if (display.icon) {
      const pct = display.mode === 'remaining' ? remaining : used;
      parts.push(gaugeIcon(pct));
    }

    // Format based on display mode
    if (display.mode === 'used') {
      parts.push(`${Math.round(used)}% used`);
    } else if (display.mode === 'remaining') {
      parts.push(`${Math.round(remaining)}% left`);
    } else if (display.mode === 'both') {
      parts.push(`${Math.round(used)}% / ${Math.round(remaining)}%`);
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
