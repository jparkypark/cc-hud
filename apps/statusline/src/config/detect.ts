/**
 * System theme detection for cchud
 */

import { execSync } from 'child_process';

/**
 * Detect the system's current theme (light or dark)
 *
 * Detection methods by platform:
 * - macOS: reads AppleInterfaceStyle from system defaults
 * - Linux: checks COLORFGBG environment variable
 * - Fallback: defaults to 'dark'
 */
export function detectSystemTheme(): 'light' | 'dark' {
  const platform = process.platform;

  if (platform === 'darwin') {
    return detectMacOSTheme();
  }

  if (platform === 'linux') {
    return detectLinuxTheme();
  }

  // Default to dark for unknown platforms
  return 'dark';
}

/**
 * Detect macOS theme using defaults command
 * AppleInterfaceStyle is "Dark" when dark mode is enabled, absent when light
 */
function detectMacOSTheme(): 'light' | 'dark' {
  try {
    const result = execSync('defaults read -g AppleInterfaceStyle 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 1000,
    }).trim();

    return result === 'Dark' ? 'dark' : 'light';
  } catch {
    // Command fails or returns empty when in light mode
    return 'light';
  }
}

/**
 * Detect Linux theme using COLORFGBG environment variable
 * Format: "fg;bg" where higher bg values typically indicate light themes
 */
function detectLinuxTheme(): 'light' | 'dark' {
  const colorFgBg = process.env.COLORFGBG;

  if (colorFgBg) {
    const parts = colorFgBg.split(';');
    const bg = parseInt(parts[parts.length - 1], 10);

    // Background values 0-6 are typically dark, 7+ are light
    if (!isNaN(bg) && bg >= 7) {
      return 'light';
    }
  }

  // Default to dark for Linux
  return 'dark';
}
