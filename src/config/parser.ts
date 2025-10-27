/**
 * Configuration parser
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config } from './types';
import { DEFAULT_CONFIG } from './defaults';
import { validateConfig } from './validator';

const CONFIG_PATH = join(homedir(), '.claude', 'cc-hud.json');

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
  // Check if config file exists
  if (!existsSync(CONFIG_PATH)) {
    console.error(
      `[cc-hud] Config file not found at ${CONFIG_PATH}, using defaults`
    );
    return DEFAULT_CONFIG;
  }

  try {
    // Read and parse config file
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(content);

    // Validate config
    validateConfig(userConfig);

    // Merge with defaults (in case user config is partial)
    const config = deepMerge(DEFAULT_CONFIG, userConfig);

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(
        `[cc-hud] Invalid JSON in config file: ${error.message}`
      );
    } else if (error instanceof Error) {
      console.error(`[cc-hud] Config validation error: ${error.message}`);
    } else {
      console.error(`[cc-hud] Failed to load config: ${error}`);
    }

    console.error('[cc-hud] Falling back to default configuration');
    return DEFAULT_CONFIG;
  }
}

/**
 * Get config file path (useful for debugging)
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}
