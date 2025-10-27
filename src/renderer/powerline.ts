/**
 * Powerline renderer
 */

import chalk from 'chalk';
import type { ThemeConfig } from '../config';
import type { SegmentData } from '../segments';
import { SEPARATORS } from './separators';

/**
 * Render segments with powerline styling
 */
export function renderPowerline(
  segments: SegmentData[],
  theme: ThemeConfig
): string {
  // Get the right separator for the configured style
  const separator = SEPARATORS[theme.separatorStyle].right;

  const parts: string[] = [];

  // Filter out empty segments
  const nonEmptySegments = segments.filter((seg) => seg.text.length > 0);

  for (let i = 0; i < nonEmptySegments.length; i++) {
    const segment = nonEmptySegments[i];
    const nextSegment = nonEmptySegments[i + 1];

    // Render segment text with padding and colors
    const styledText = chalk
      .hex(segment.colors.fg)
      .bgHex(segment.colors.bg)(` ${segment.text} `);

    parts.push(styledText);

    // Add separator between segments
    if (theme.powerline) {
      if (nextSegment) {
        // Separator between two segments
        // Foreground = current segment bg, Background = next segment bg
        const styledSeparator = chalk
          .hex(segment.colors.bg)
          .bgHex(nextSegment.colors.bg)(separator);

        parts.push(styledSeparator);
      } else {
        // Final separator (current segment bg on terminal default)
        const styledSeparator = chalk.hex(segment.colors.bg)(separator);
        parts.push(styledSeparator);
      }
    }
  }

  return parts.join('');
}
