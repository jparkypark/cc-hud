/**
 * Time segment - displays current time when statusline was rendered
 */

import type { ClaudeCodeInput, TimeSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';

export class TimeSegment extends Segment {
  protected config: TimeSegmentConfig;

  constructor(config: TimeSegmentConfig) {
    super(config);
    this.config = config;
  }

  render(_input: ClaudeCodeInput, _db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    const now = new Date();
    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('◔');  // Clock icon
    }

    // Format time
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    let timeStr: string;

    if (display.format === '12h') {
      const period = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      timeStr = display.seconds
        ? `${hours}:${minutes}:${seconds}${period}`
        : `${hours}:${minutes}${period}`;
    } else {
      const hoursStr = hours.toString().padStart(2, '0');
      timeStr = display.seconds
        ? `${hoursStr}:${minutes}:${seconds}`
        : `${hoursStr}:${minutes}`;
    }

    parts.push(timeStr);

    return {
      text: parts.join(' '),
      colors,
    };
  }
}
