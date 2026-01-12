/**
 * Powerline separator definitions
 */

import type { SeparatorStyle } from '../config';

export interface Separators {
  right: string;
  left: string;
}

/**
 * Standard powerline separators
 * Note: These work best with Nerd Fonts, but have reasonable fallbacks in most fonts
 */
export const SEPARATORS: Record<SeparatorStyle, Separators> = {
  angled: {
    right: '\uE0B0', //  Sharp arrow/chevron
    left: '\uE0B2',  //
  },
  thin: {
    right: '\uE0B1', //  Thin vertical line
    left: '\uE0B3',  //
  },
  rounded: {
    right: '\uE0B4', //  Rounded edge
    left: '\uE0B6',  //
  },
  flame: {
    right: '\uE0C0', //  Wavy/flame pattern
    left: '\uE0C2',  //
  },
  slant: {
    right: '\uE0BC', //  Diagonal/slant (/)
    left: '\uE0BE',  //
  },
  backslant: {
    right: '\uE0B8', //  Diagonal/slant (\)
    left: '\uE0BA',  //
  },
};
