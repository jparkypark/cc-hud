/**
 * Theme color presets for cchud
 */

import type { SegmentColors, ThemeMode, SegmentType, ThemeColorOverrides } from './types';

export type ThemeColors = Record<SegmentType, SegmentColors>;

/**
 * Dark theme - optimized for dark terminal backgrounds
 * Uses vibrant, saturated colors that pop on dark backgrounds
 */
export const DARK_THEME_COLORS: ThemeColors = {
  directory: {
    fg: '#ff6666',
    bg: '#ec4899',
  },
  git: {
    fg: '#ffbd55',
    bg: '#f97316',
  },
  pr: {
    fg: '#ffff66',
    bg: '#10b981',
  },
  usage: {
    fg: '#9de24f',
    bg: '#3b82f6',
  },
  pace: {
    fg: '#87cefa',
    bg: '#9333ea',
  },
  time: {
    fg: '#c084fc',
    bg: '#9333ea',
  },
  thoughts: {
    fg: '#9ca3af',
    bg: '#6b7280',
  },
};

/**
 * Light theme - optimized for light terminal backgrounds
 * Bright rainbow colors with white text for contrast
 */
export const LIGHT_THEME_COLORS: ThemeColors = {
  directory: {
    fg: '#ff0000',  // bright red
    bg: '#dc2626',
  },
  git: {
    fg: '#ff8000',  // bright orange
    bg: '#ea580c',
  },
  pr: {
    fg: '#e6b800',  // bright yellow (darkened for readability)
    bg: '#ca8a04',
  },
  usage: {
    fg: '#00cc00',  // bright green
    bg: '#16a34a',
  },
  pace: {
    fg: '#00b3b3',  // bright cyan
    bg: '#0891b2',
  },
  time: {
    fg: '#0066ff',  // bright blue
    bg: '#2563eb',
  },
  thoughts: {
    fg: '#8000ff',  // bright violet
    bg: '#7c3aed',
  },
};

/**
 * Get base theme colors for the specified mode
 */
export function getThemeColors(mode: Exclude<ThemeMode, 'auto'>): ThemeColors {
  return mode === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS;
}

/**
 * Merge user theme overrides with base theme colors
 */
export function mergeThemeColors(
  baseTheme: ThemeColors,
  overrides?: ThemeColorOverrides
): ThemeColors {
  if (!overrides) {
    return baseTheme;
  }

  const result = { ...baseTheme };

  for (const segmentType of Object.keys(overrides) as SegmentType[]) {
    const override = overrides[segmentType];
    if (override) {
      result[segmentType] = {
        fg: override.fg ?? baseTheme[segmentType].fg,
        bg: override.bg ?? baseTheme[segmentType].bg,
      };
    }
  }

  return result;
}
