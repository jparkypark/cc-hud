/**
 * PR utilities - fetch PR information using GitHub CLI (gh)
 */

export interface PrInfo {
  number: number;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
}

/**
 * Get PR information for the current branch using gh CLI
 * Returns null if no PR exists, gh is not installed, or not authenticated
 */
export function getPrInfoSync(cwd: string): PrInfo | null {
  try {
    // Run gh pr view to get PR info for current branch
    const result = Bun.spawnSync(
      ['gh', 'pr', 'view', '--json', 'number,url,state'],
      { cwd }
    );

    if (!result.success) {
      // No PR for this branch, gh not installed, or not authenticated
      return null;
    }

    const output = result.stdout.toString().trim();
    if (!output) return null;

    const data = JSON.parse(output);

    if (typeof data.number !== 'number' || typeof data.url !== 'string' || typeof data.state !== 'string') {
      return null;
    }

    return {
      number: data.number,
      url: data.url,
      state: data.state as PrInfo['state'],
    };
  } catch {
    // JSON parse error or other failure
    return null;
  }
}
