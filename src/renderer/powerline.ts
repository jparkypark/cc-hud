/**
 * Powerline renderer
 */

import chalk from 'chalk';
import type { ThemeConfig } from '../config';
import type { SegmentData } from '../segments';
import { SEPARATORS } from './separators';

// Force chalk to use true-color (24-bit RGB) support
// Level 3 = 16 million colors (full RGB)
chalk.level = 3;

/**
 * Darken a hex color by a percentage (0-1)
 * This helps compensate for font rendering making separators appear lighter
 */
function darkenColor(hex: string, amount: number = 0.1): string {
  // Remove # if present
  const color = hex.replace('#', '');

  // Parse RGB components
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Darken by reducing each component
  const newR = Math.round(r * (1 - amount));
  const newG = Math.round(g * (1 - amount));
  const newB = Math.round(b * (1 - amount));

  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

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
        // Foreground = current segment bg (darkened to compensate for font rendering)
        // Background = next segment bg
        const darkenedFg = darkenColor(segment.colors.bg, 0.1);
        const styledSeparator = chalk
          .hex(darkenedFg)
          .bgHex(nextSegment.colors.bg)(separator);

        parts.push(styledSeparator);
      } else {
        // Final separator (current segment bg on terminal default, darkened)
        const darkenedFg = darkenColor(segment.colors.bg, 0.1);
        const styledSeparator = chalk.hex(darkenedFg)(separator);
        parts.push(styledSeparator);
      }
    }
  }

  return parts.join('');
}
