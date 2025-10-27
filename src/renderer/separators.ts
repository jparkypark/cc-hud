/**
 * Powerline separator definitions
 */

import type { SeparatorStyle } from '../config';

export interface Separators {
  right: string;
  left: string;
}

/**
 * Nerd Font powerline separators
 */
export const SEPARATORS: Record<SeparatorStyle, Separators> = {
  angled: {
    right: '\uE0B0', //
    left: '\uE0B2',  //
  },
  thin: {
    right: '\uE0B1', //
    left: '\uE0B3',  //
  },
  rounded: {
    right: '\uE0B4', //
    left: '\uE0B6',  //
  },
  flame: {
    right: '\uE0C0', //
    left: '\uE0C2',  //
  },
};
