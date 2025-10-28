/**
 * Directory segment - displays current working directory
 */

import { homedir } from 'os';
import { basename } from 'path';
import type { ClaudeCodeInput, DirectorySegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';

/**
 * Get git repository root directory
 */
function getGitRoot(cwd: string): string | null {
  try {
    const result = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel'], {
      cwd,
    });
    if (result.success) {
      return result.stdout.toString().trim();
    }
    return null;
  } catch {
    return null;
  }
}

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
        // Show path relative to git repository root
        // e.g., if git root is ~/worktrees/spacewalker-eng-1446
        //       and cwd is ~/worktrees/spacewalker-eng-1446/apps/backend
        //       show: spacewalker-eng-1446/apps/backend
        const gitRoot = getGitRoot(cwd);

        if (gitRoot && cwd.startsWith(gitRoot)) {
          const projectName = basename(gitRoot);
          const relativePath = cwd.slice(gitRoot.length);
          text += projectName + relativePath;
        } else {
          // Fallback to just directory name if not in a git repo
          text += cwd.split('/').pop() || cwd;
        }
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
