/**
 * Git utilities - fetch git information by running git commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitInfo {
  branch: string | null;
  isDirty: boolean;
  ahead: number;
  behind: number;
}

/**
 * Get git information for the current directory
 */
export async function getGitInfo(cwd: string): Promise<GitInfo | null> {
  try {
    // Check if we're in a git repository
    await execAsync('git rev-parse --git-dir', { cwd });

    // Get current branch
    const { stdout: branch } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd }
    );

    // Check if working directory is dirty
    const { stdout: status } = await execAsync('git status --porcelain', {
      cwd,
    });

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;

    try {
      const { stdout: counts } = await execAsync(
        'git rev-list --left-right --count HEAD...@{upstream}',
        { cwd }
      );
      const parts = counts.trim().split(/\s+/);
      ahead = parseInt(parts[0] || '0', 10);
      behind = parseInt(parts[1] || '0', 10);
    } catch {
      // No upstream branch, that's ok
    }

    return {
      branch: branch.trim(),
      isDirty: status.trim().length > 0,
      ahead,
      behind,
    };
  } catch {
    // Not a git repository or git command failed
    return null;
  }
}

/**
 * Synchronous version using Bun's spawn (blocking)
 */
export function getGitInfoSync(cwd: string): GitInfo | null {
  try {
    // Check if we're in a git repository
    const checkGit = Bun.spawnSync(['git', 'rev-parse', '--git-dir'], { cwd });
    if (!checkGit.success) return null;

    // Get current branch
    const branchResult = Bun.spawnSync(
      ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd }
    );
    if (!branchResult.success) return null;
    const branch = branchResult.stdout.toString().trim();

    // Check if working directory is dirty
    const statusResult = Bun.spawnSync(['git', 'status', '--porcelain'], {
      cwd,
    });
    const isDirty = statusResult.stdout.toString().trim().length > 0;

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;

    const countsResult = Bun.spawnSync(
      ['git', 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
      { cwd }
    );
    if (countsResult.success) {
      const parts = countsResult.stdout.toString().trim().split(/\s+/);
      ahead = parseInt(parts[0] || '0', 10);
      behind = parseInt(parts[1] || '0', 10);
    }

    return {
      branch,
      isDirty,
      ahead,
      behind,
    };
  } catch {
    return null;
  }
}
