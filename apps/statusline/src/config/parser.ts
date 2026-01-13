/**
 * Configuration parser
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config, SegmentConfig, SegmentType, ThemeMode } from './types';
import { DEFAULT_CONFIG } from './defaults';
import { validateConfig } from './validator';
import { detectSystemTheme } from './detect';
import { getThemeColors, mergeThemeColors } from './themes';

const CONFIG_PATH = join(homedir(), '.claude', 'cchud.json');

/**
 * Deep merge two objects
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue as any);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Load and parse config file
 */
export function loadConfig(): Config {
  let userConfig: Partial<Config> | undefined;

  // Check if config file exists
  if (!existsSync(CONFIG_PATH)) {
    console.error(
      `[cchud] Config file not found at ${CONFIG_PATH}, using defaults`
    );
    userConfig = undefined;
  } else {
    try {
      // Read and parse config file
      const content = readFileSync(CONFIG_PATH, 'utf-8');
      userConfig = JSON.parse(content);

      // Validate config
      validateConfig(userConfig);
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(
          `[cchud] Invalid JSON in config file: ${error.message}`
        );
      } else if (error instanceof Error) {
        console.error(`[cchud] Config validation error: ${error.message}`);
      } else {
        console.error(`[cchud] Failed to load config: ${error}`);
      }

      console.error('[cchud] Falling back to default configuration');
      userConfig = undefined;
    }
  }

  // Merge with defaults (in case user config is partial)
  const config = userConfig ? deepMerge(DEFAULT_CONFIG, userConfig) : DEFAULT_CONFIG;

  // Resolve theme mode and apply theme colors
  const resolvedTheme = resolveThemeMode(config.theme.themeMode);
  const themedConfig = applyThemeColors(config, userConfig, resolvedTheme);

  return themedConfig;
}

/**
 * Resolve 'auto' theme mode to actual light/dark value
 */
function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return detectSystemTheme();
  }
  return mode;
}

/**
 * Apply theme colors to segments that don't have explicit user color overrides
 */
function applyThemeColors(
  config: Config,
  userConfig: Partial<Config> | undefined,
  resolvedTheme: 'light' | 'dark'
): Config {
  // Get base theme colors and merge with user's custom theme overrides
  const baseTheme = getThemeColors(resolvedTheme);
  const userThemeOverrides = resolvedTheme === 'light'
    ? userConfig?.lightTheme
    : userConfig?.darkTheme;
  const themeColors = mergeThemeColors(baseTheme, userThemeOverrides);

  // Apply theme colors to each segment
  const segments = config.segments.map((segment, index) => {
    const segmentType = segment.type as SegmentType;
    const themeSegmentColors = themeColors[segmentType];

    // Check if user provided explicit color overrides in segments array
    const userSegment = userConfig?.segments?.[index];
    const userColors = userSegment?.colors;

    if (!themeSegmentColors) {
      return segment;
    }

    // Merge: theme colors <- user segment color overrides
    const colors = {
      fg: userColors?.fg ?? themeSegmentColors.fg,
      bg: userColors?.bg ?? themeSegmentColors.bg,
    };

    return { ...segment, colors } as SegmentConfig;
  });

  return { ...config, segments };
}

/**
 * Get config file path (useful for debugging)
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}
