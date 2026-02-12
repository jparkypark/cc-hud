/**
 * Usage segment - displays daily cost and token usage
 * Combines Claude Code (ccusage) and Codex CLI (@ccusage/codex) usage
 */

import type { ClaudeCodeInput, UsageSegmentConfig } from '../config';
import { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { loadDailyUsageData } from 'ccusage/data-loader';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Default cache TTL (can be overridden in config)
const DEFAULT_CACHE_TTL_MINUTES = 1;
const CACHE_DIR = join(homedir(), '.cache', 'chud');
const CLAUDE_CACHE_FILE = join(CACHE_DIR, 'claude-usage.json');
const CODEX_CACHE_FILE = join(CACHE_DIR, 'codex-usage.json');

// Stale lock timeout: if a refreshing process crashes, the lock expires after this
const REFRESH_LOCK_TIMEOUT_MS = 30_000;

interface UsageCacheData {
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

interface CacheResult {
  data: UsageCacheData | null;
  fresh: boolean;
}

/**
 * Load cached data. Returns { data, fresh } where:
 * - data is the cached entry (or null if no cache exists at all)
 * - fresh is true if the cache is within TTL
 * This allows callers to use stale data while a single process refreshes.
 */
function loadCache(cacheFile: string, today: string, cacheTtlMs: number): CacheResult {
  try {
    if (!existsSync(cacheFile)) return { data: null, fresh: false };

    const cached: UsageCacheData = JSON.parse(
      readFileSync(cacheFile, 'utf-8')
    );

    // Wrong date = treat as no cache (stale across midnight)
    if (cached.date !== today) return { data: null, fresh: false };

    const now = Date.now();
    const fresh = now - cached.timestamp < cacheTtlMs;
    return { data: cached, fresh };
  } catch {
    return { data: null, fresh: false };
  }
}

/**
 * Try to acquire a refresh lock for a cache file.
 * Returns true if this process should perform the refresh.
 * Uses a .refreshing lock file with a crash-guard timeout.
 */
function tryAcquireRefreshLock(cacheFile: string): boolean {
  const lockFile = cacheFile + '.refreshing';
  try {
    if (existsSync(lockFile)) {
      // Check if the lock is stale (process crashed while refreshing)
      const stat = statSync(lockFile);
      if (Date.now() - stat.mtimeMs < REFRESH_LOCK_TIMEOUT_MS) {
        return false; // Another process is actively refreshing
      }
      // Stale lock — take over
    }
    // Write our PID so we can identify the owner if needed
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(lockFile, String(process.pid));
    return true;
  } catch {
    return false;
  }
}

/**
 * Release the refresh lock after recomputing.
 */
function releaseRefreshLock(cacheFile: string): void {
  const lockFile = cacheFile + '.refreshing';
  try {
    unlinkSync(lockFile);
  } catch {
    // Ignore — file may already be gone
  }
}

/**
 * Save data to cache
 */
function saveCache(cacheFile: string, data: UsageCacheData): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(cacheFile, JSON.stringify(data));
  } catch {
    // Ignore cache write errors
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
 * Fetch today's Codex usage via @ccusage/codex CLI (stale-while-revalidate)
 */
async function loadCodexTodayData(timezone: string, cacheTtlMs: number): Promise<{
  cost: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const today = getTodayDate();
  const zero = { cost: 0, inputTokens: 0, outputTokens: 0 };
  const { data: cached, fresh } = loadCache(CODEX_CACHE_FILE, today, cacheTtlMs);
  const staleResult = cached
    ? { cost: cached.cost, inputTokens: cached.inputTokens, outputTokens: cached.outputTokens }
    : zero;

  // Cache is fresh — return immediately
  if (fresh) return staleResult;

  // Cache is stale or missing. Try to acquire refresh lock.
  if (!tryAcquireRefreshLock(CODEX_CACHE_FILE)) {
    // Another process is refreshing — return stale data (or zeros if first run)
    return staleResult;
  }

  try {
    // Run ccusage-codex with JSON output, filtering to today only
    const proc = Bun.spawn(
      ['bunx', '@ccusage/codex@latest', 'daily', '--json', '--since', today, '--timezone', timezone],
      { stdout: 'pipe', stderr: 'pipe' }
    );

    // Set a 5 second timeout
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
      return staleResult;
    }

    const data: CodexDailyData = JSON.parse(output);

    const result = {
      cost: data.totals?.costUSD || 0,
      inputTokens: data.totals?.inputTokens || 0,
      outputTokens: data.totals?.outputTokens || 0,
    };

    // Cache the result
    saveCache(CODEX_CACHE_FILE, {
      date: today,
      ...result,
      timestamp: Date.now(),
    });

    return result;
  } catch {
    return staleResult;
  } finally {
    releaseRefreshLock(CODEX_CACHE_FILE);
  }
}

/**
 * Load today's Claude Code usage via ccusage (stale-while-revalidate)
 * When cache expires, returns stale data immediately while one process refreshes.
 */
async function loadClaudeTodayData(timezone: string, cacheTtlMs: number): Promise<{
  cost: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const today = getTodayDate();
  const zero = { cost: 0, inputTokens: 0, outputTokens: 0 };
  const { data: cached, fresh } = loadCache(CLAUDE_CACHE_FILE, today, cacheTtlMs);
  const staleResult = cached
    ? { cost: cached.cost, inputTokens: cached.inputTokens, outputTokens: cached.outputTokens }
    : zero;

  // Cache is fresh — return immediately
  if (fresh) return staleResult;

  // Cache is stale or missing. Try to acquire refresh lock.
  if (!tryAcquireRefreshLock(CLAUDE_CACHE_FILE)) {
    // Another process is refreshing — return stale data (or zeros if first run)
    return staleResult;
  }

  try {
    // Suppress ccusage logging
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
      // Load data using ccusage (slow but accurate)
      const data = await loadDailyUsageData({
        offline: false,
        timezone,
      });

      // Find today's data
      const todayData = data.find((d) => d.date === today);

      const result = todayData
        ? {
            cost: todayData.totalCost,
            inputTokens: todayData.inputTokens,
            outputTokens: todayData.outputTokens,
          }
        : zero;

      // Cache the result
      saveCache(CLAUDE_CACHE_FILE, {
        date: today,
        ...result,
        timestamp: Date.now(),
      });

      return result;
    } finally {
      // Restore console methods
      console.error = originalStderr;
      console.log = originalConsoleLog;
      console.info = originalConsoleInfo;
      console.warn = originalConsoleWarn;
      process.stderr.write = originalProcessStderrWrite;
      process.stdout.write = originalProcessStdoutWrite;
    }
  } catch (error) {
    console.error('[chud] Failed to load usage data from ccusage:', error);
    return staleResult;
  } finally {
    releaseRefreshLock(CLAUDE_CACHE_FILE);
  }
}

export class UsageSegment extends Segment {
  protected config: UsageSegmentConfig;
  private cachedData: { date: string; cost: number; tokens: number; inputTokens: number; outputTokens: number } | null =
    null;

  constructor(config: UsageSegmentConfig) {
    super(config);
    this.config = config;
  }

  /**
   * Get cache TTL in milliseconds from config
   */
  private getCacheTtlMs(): number {
    const minutes = this.config.display.cacheTtlMinutes ?? DEFAULT_CACHE_TTL_MINUTES;
    return minutes * 60 * 1000;
  }

  /**
   * Load today's data from ccusage (with disk caching)
   */
  async loadTodayData(): Promise<{
    cost: number;
    inputTokens: number;
    outputTokens: number;
  }> {
    const timezone = getSystemTimezone();
    return loadClaudeTodayData(timezone, this.getCacheTtlMs());
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    const parts: string[] = [];

    if (display.icon) {
      parts.push('Σ');
    }

    if (display.cost) {
      const cost = this.cachedData?.cost || 0;
      parts.push(`$${cost.toFixed(2)}`);
    }

    if (display.tokens) {
      const totalTokens = this.cachedData?.tokens || 0;
      parts.push(formatTokens(totalTokens));
    }

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
   * @param cacheTtlOverrideMs - Optional TTL override in ms (from --cache-ttl flag)
   */
  async updateCache(cacheTtlOverrideMs?: number): Promise<void> {
    const timezone = getSystemTimezone();
    const cacheTtlMs = cacheTtlOverrideMs ?? this.getCacheTtlMs();

    // Fetch Claude Code and Codex usage in parallel
    const [claudeData, codexData] = await Promise.all([
      this.loadTodayData(),
      loadCodexTodayData(timezone, cacheTtlMs),
    ]);

    const inputTokens = claudeData.inputTokens + codexData.inputTokens;
    const outputTokens = claudeData.outputTokens + codexData.outputTokens;

    // Combine costs and tokens
    this.cachedData = {
      date: getTodayDate(),
      cost: claudeData.cost + codexData.cost,
      tokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
    };
  }

  /**
   * Load usage data from DB (populated by the ticker in standalone mode)
   */
  loadFromDb(db: DatabaseClient): void {
    const today = getTodayDate();
    const usage = db.getDailyUsage(1);
    const todayRecord = usage.find((r) => r.date === today);
    if (todayRecord) {
      this.cachedData = {
        date: today,
        cost: todayRecord.cost,
        tokens: todayRecord.input_tokens + todayRecord.output_tokens,
        inputTokens: todayRecord.input_tokens,
        outputTokens: todayRecord.output_tokens,
      };
    }
  }

  /**
   * Get the cached data for persistence to database
   */
  getCachedData(): { date: string; cost: number; inputTokens: number; outputTokens: number } | null {
    if (!this.cachedData) return null;
    return {
      date: this.cachedData.date,
      cost: this.cachedData.cost,
      inputTokens: this.cachedData.inputTokens,
      outputTokens: this.cachedData.outputTokens,
    };
  }
}
