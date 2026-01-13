/**
 * Usage segment - displays daily cost and token usage
 * Combines Claude Code (ccusage) and Codex CLI (@ccusage/codex) usage
 */

import type { ClaudeCodeInput, UsageSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { loadDailyUsageData } from 'ccusage/data-loader';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Cache Codex data for 5 minutes to avoid slow CLI calls
const CODEX_CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_DIR = join(homedir(), '.cache', 'chud');
const CODEX_CACHE_FILE = join(CACHE_DIR, 'codex-usage.json');

interface CodexCacheData {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
}

/**
 * Format token count with K/M suffix
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Detect system timezone (best effort)
 */
function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

interface CodexDailyData {
  daily: Array<{
    date: string;
    costUSD: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>;
  totals: {
    costUSD: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Load cached Codex data if valid
 */
function loadCodexCache(today: string): CodexCacheData | null {
  try {
    if (!existsSync(CODEX_CACHE_FILE)) return null;

    const cached: CodexCacheData = JSON.parse(
      readFileSync(CODEX_CACHE_FILE, 'utf-8')
    );

    // Check if cache is valid (same date and not expired)
    const now = Date.now();
    if (cached.date === today && now - cached.timestamp < CODEX_CACHE_TTL_MS) {
      return cached;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Save Codex data to cache
 */
function saveCodexCache(data: CodexCacheData): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CODEX_CACHE_FILE, JSON.stringify(data));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Fetch today's Codex usage via @ccusage/codex CLI (with caching)
 */
async function loadCodexTodayData(timezone: string): Promise<{
  cost: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const today = getTodayDate();

  // Check cache first
  const cached = loadCodexCache(today);
  if (cached) {
    return {
      cost: cached.cost,
      inputTokens: cached.inputTokens,
      outputTokens: cached.outputTokens,
    };
  }

  try {
    // Run ccusage-codex with JSON output, filtering to today only
    // Use Bun.spawn for async execution with shorter timeout
    const proc = Bun.spawn(
      ['bunx', '@ccusage/codex@latest', 'daily', '--json', '--since', today, '--timezone', timezone],
      { stdout: 'pipe', stderr: 'pipe' }
    );

    // Set a 5 second timeout (much shorter than original 30s)
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 5000)
    );

    const resultPromise = (async () => {
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0) return null;
      return output;
    })();

    const output = await Promise.race([resultPromise, timeoutPromise]);
    if (!output) {
      return { cost: 0, inputTokens: 0, outputTokens: 0 };
    }

    const data: CodexDailyData = JSON.parse(output);

    const result = {
      cost: data.totals?.costUSD || 0,
      inputTokens: data.totals?.inputTokens || 0,
      outputTokens: data.totals?.outputTokens || 0,
    };

    // Cache the result
    saveCodexCache({
      date: today,
      ...result,
      timestamp: Date.now(),
    });

    return result;
  } catch {
    // Silently fail if Codex CLI not available or errors
    return { cost: 0, inputTokens: 0, outputTokens: 0 };
  }
}

export class UsageSegment extends Segment {
  protected config: UsageSegmentConfig;
  private cachedData: { date: string; cost: number; tokens: number } | null =
    null;

  constructor(config: UsageSegmentConfig) {
    super(config);
    this.config = config;
  }

  /**
   * Load today's data from ccusage
   */
  async loadTodayData(): Promise<{
    cost: number;
    inputTokens: number;
    outputTokens: number;
  }> {
    try {
      const today = getTodayDate();
      const timezone = getSystemTimezone();

      // Suppress ccusage logging by temporarily redirecting all output
      const originalStderr = console.error;
      const originalConsoleLog = console.log;
      const originalConsoleInfo = console.info;
      const originalConsoleWarn = console.warn;
      const originalProcessStderrWrite = process.stderr.write;
      const originalProcessStdoutWrite = process.stdout.write;

      console.error = () => {};
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
      process.stderr.write = () => true;
      process.stdout.write = () => true;

      try {
        // Load all data using ccusage
        // Use offline: false to fetch latest pricing (includes newer models like haiku-4-5)
        const data = await loadDailyUsageData({
          offline: false,
          timezone,
        });

        // Find today's data
        const todayData = data.find((d) => d.date === today);

        return todayData
          ? {
              cost: todayData.totalCost,
              inputTokens: todayData.inputTokens,
              outputTokens: todayData.outputTokens,
            }
          : { cost: 0, inputTokens: 0, outputTokens: 0 };
      } finally {
        // Restore console and process methods
        console.error = originalStderr;
        console.log = originalConsoleLog;
        console.info = originalConsoleInfo;
        console.warn = originalConsoleWarn;
        process.stderr.write = originalProcessStderrWrite;
        process.stdout.write = originalProcessStdoutWrite;
      }
    } catch (error) {
      console.error('[chud] Failed to load usage data from ccusage:', error);
      return { cost: 0, inputTokens: 0, outputTokens: 0 };
    }
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Note: render() is synchronous, but we need async data
    // We'll need to handle this in the main entry point
    // For now, show cached data or placeholder
    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('Σ');  // Sigma - summation (daily total)
    }

    if (display.cost) {
      const cost = this.cachedData?.cost || 0;
      parts.push(`$${cost.toFixed(2)}`);
    }

    if (display.tokens) {
      const totalTokens = this.cachedData?.tokens || 0;
      parts.push(formatTokens(totalTokens));
    }

    // Always show period label if enabled
    if (display.period) {
      parts.push(display.period);
    }

    return {
      text: parts.join(' '),
      colors,
    };
  }

  /**
   * Update cached data (call this before render)
   * Fetches both Claude Code and Codex usage in parallel
   */
  async updateCache(): Promise<void> {
    const timezone = getSystemTimezone();

    // Fetch Claude Code and Codex usage in parallel
    const [claudeData, codexData] = await Promise.all([
      this.loadTodayData(),
      loadCodexTodayData(timezone),
    ]);

    // Combine costs and tokens
    this.cachedData = {
      date: getTodayDate(),
      cost: claudeData.cost + codexData.cost,
      tokens:
        claudeData.inputTokens +
        claudeData.outputTokens +
        codexData.inputTokens +
        codexData.outputTokens,
    };
  }
}
