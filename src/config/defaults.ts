/**
 * Default configuration for cc-hud
 */

import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  segments: [
    {
      type: 'usage',
      display: {
        cost: true,
        tokens: false,
        period: 'today',
      },
      colors: {
        fg: '#88c0d0',
        bg: '#2e3440',
      },
    },
    {
      type: 'directory',
      display: {
        icon: true,
        fullPath: false,
      },
      colors: {
        fg: '#d8dee9',
        bg: '#2e3440',
      },
    },
    {
      type: 'git',
      display: {
        branch: true,
        status: true,
        ahead: true,
        behind: true,
      },
      colors: {
        fg: '#8fbcbb',
        bg: '#2e3440',
      },
    },
  ],
  theme: {
    powerline: true,
    separatorStyle: 'angled',
  },
};
