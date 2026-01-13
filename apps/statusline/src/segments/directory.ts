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

    // Get git root for path display and warning detection
    const gitRoot = getGitRoot(cwd);

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

      case 'parent': {
        // Show path relative to parent of git repository root
        // e.g., if git root is /Users/jp/repos/chud
        //       and cwd is /Users/jp/repos/chud/src/segments
        //       show: repos/chud/src/segments

        if (gitRoot && cwd.startsWith(gitRoot)) {
          const gitRootParts = gitRoot.split('/').filter(p => p);
          const cwdParts = cwd.split('/').filter(p => p);

          // Get the parent directory name (one level up from git root)
          const parentName = gitRootParts[gitRootParts.length - 2] || '';
          const projectName = basename(gitRoot);
          const relativePath = cwd.slice(gitRoot.length);

          text += parentName ? `${parentName}/${projectName}${relativePath}` : `${projectName}${relativePath}`;
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

    // Add warning if not in project root
    if (display.rootWarning && gitRoot) {
      let showWarning = false;

      // Get session ID from either location (Claude Code uses session_id at top level)
      const sessionId = (input as any).session_id || input.session?.id;

      if (sessionId) {
        // Session-based: check cached initial state
        const wasRootAtStart = db.getSessionRootStatus(
          sessionId,
          cwd,
          gitRoot
        );
        showWarning = !wasRootAtStart;
      } else {
        // Fallback: current cwd check (when no session ID)
        showWarning = cwd !== gitRoot;
      }

      if (showWarning) {
        text += ' ✗ session not started in project root';
      }
    }

    return {
      text,
      colors,
    };
  }
}
