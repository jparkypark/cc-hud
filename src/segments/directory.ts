/**
 * Directory segment - displays current working directory
 */

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
      text += ' ';  // Nerd Font folder icon
    }

    // Show full path or just directory name
    if (display.fullPath) {
      // Replace home directory with ~
      const homeDir = require('os').homedir();
      text += cwd.replace(homeDir, '~');
    } else {
      // Just the directory name
      const dirName = cwd.split('/').pop() || cwd;
      text += dirName;
    }

    return {
      text,
      colors,
    };
  }
}
