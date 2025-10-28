/**
 * Usage segment - displays daily cost and token usage
 * Uses ccusage library for real-time cost calculation from JSONL transcripts
 */

import type { ClaudeCodeInput, UsageSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { loadDailyUsageData } from 'ccusage/data-loader';

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
      console.error('[cc-hud] Failed to load usage data from ccusage:', error);
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
   */
  async updateCache(): Promise<void> {
    const data = await this.loadTodayData();
    this.cachedData = {
      date: getTodayDate(),
      cost: data.cost,
      tokens: data.inputTokens + data.outputTokens,
    };
  }
}
