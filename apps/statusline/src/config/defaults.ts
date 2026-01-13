/**
 * Default configuration for chud
 */

import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  segments: [
    {
      type: 'directory',
      display: {
        icon: true,
        pathMode: 'parent',
        rootWarning: false,
      },
      colors: {
        fg: '#ff6666',
        bg: '#ec4899',
      },
    },
    {
      type: 'git',
      display: {
        icon: true,
        branch: true,
        status: true,
        ahead: true,
        behind: true,
      },
      colors: {
        fg: '#ffbd55',
        bg: '#f97316',
      },
    },
    {
      type: 'pr',
      display: {
        icon: true,
        number: true,
      },
      colors: {
        fg: '#ffff66',
        bg: '#10b981',
      },
    },
    {
      type: 'usage',
      display: {
        icon: true,
        cost: true,
        tokens: false,
        period: 'today',
      },
      colors: {
        fg: '#9de24f',
        bg: '#3b82f6',
      },
    },
    {
      type: 'pace',
      display: {
        icon: true,
        period: 'hourly',
        halfLifeMinutes: 7,  // ~10 minute effective window for EWMA smoothing
      },
      colors: {
        fg: '#87cefa',
        bg: '#9333ea',
      },
    },
    {
      type: 'context',
      display: {
        icon: true,
        mode: 'used',  // Show context window used percentage
      },
      colors: {
        fg: '#a5b4fc',
        bg: '#6366f1',
      },
    },
    {
      type: 'time',
      display: {
        icon: true,
        format: '12h',
        seconds: false,
      },
      colors: {
        fg: '#c084fc',
        bg: '#9333ea',
      },
    },
    {
      type: 'thoughts',
      display: {
        icon: true,
        quotes: false,
      },
      colors: {
        fg: '#9ca3af',
        bg: '#6b7280',
      },
      useApiQuotes: true,
    },
  ],
  theme: {
    powerline: true,
    separatorStyle: 'angled',
    colorMode: 'text',
    themeMode: 'auto',
  },
};
