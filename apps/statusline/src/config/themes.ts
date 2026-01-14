/**
 * Theme color presets for chud
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
  context: {
    fg: '#a5b4fc',
    bg: '#6366f1',
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
 * Light theme - Tailwind 500 rainbow colors
 * Used as the default theme overall
 */
export const LIGHT_THEME_COLORS: ThemeColors = {
  directory: {
    fg: '#ffffff',
    bg: '#ef4444',  // red-500
  },
  git: {
    fg: '#ffffff',
    bg: '#f97316',  // orange-500
  },
  pr: {
    fg: '#ffffff',
    bg: '#eab308',  // yellow-500
  },
  usage: {
    fg: '#ffffff',
    bg: '#22c55e',  // green-500
  },
  pace: {
    fg: '#ffffff',
    bg: '#06b6d4',  // cyan-500
  },
  context: {
    fg: '#ffffff',
    bg: '#3b82f6',  // blue-500
  },
  time: {
    fg: '#ffffff',
    bg: '#6366f1',  // indigo-500
  },
  thoughts: {
    fg: '#ffffff',
    bg: '#8b5cf6',  // violet-500
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
