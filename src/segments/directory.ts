/**
 * Directory segment - displays current working directory
 */

import { homedir } from 'os';
import type { ClaudeCodeInput, DirectorySegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';

export class DirectorySegment extends Segment {
  protected config: DirectorySegmentConfig;

  constructor(config: DirectorySegmentConfig) {
    super(config);
    this.config = config;
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Get current working directory
    const cwd = input.cwd || process.cwd();

    let text = '';

    // Add folder icon if enabled
    if (display.icon) {
      text += '› ';  // Right angle quote
    }

    switch (display.pathMode) {
      case 'full':
        // Replace home directory with ~
        text += cwd.replace(homedir(), '~');
        break;

      case 'project': {
        // Show path starting from project root
        // e.g., ~/repos/cc-hud/src -> cc-hud/src
        const relativeToCwd = cwd
          .replace(homedir(), '')
          .split('/')
          .filter((p) => p.length > 0);

        // If path is like ['repos', 'cc-hud', 'src'], show from 'cc-hud' onwards
        // If path is like ['cc-hud', 'src'], show everything
        const startIndex =
          relativeToCwd.length >= 2 && relativeToCwd[0] === 'repos' ? 1 : 0;
        text += relativeToCwd.slice(startIndex).join('/');
        break;
      }

      case 'name':
      default:
        // Just the directory name
        text += cwd.split('/').pop() || cwd;
        break;
    }

    return {
      text,
      colors,
    };
  }
}
