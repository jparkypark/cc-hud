/**
 * Usage segment - displays daily cost and token usage
 * Uses ccusage library for accurate cost calculation from JSONL transcripts
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

  async loadTodayData(): Promise<{
    cost: number;
    inputTokens: number;
    outputTokens: number;
  }> {
    try {
      const today = getTodayDate();
      const timezone = getSystemTimezone();

      // Load all data using ccusage
      // Note: We load all data and filter manually because ccusage's date
      // filtering doesn't seem to work reliably with since/until params
      // Use offline: false to fetch latest pricing (includes newer models like haiku-4-5)
      const data = await loadDailyUsageData({
        offline: false, // Fetch latest pricing for accuracy
        timezone,
      });

      // Find today's data
      const todayData = data.find((d) => d.date === today);

      if (todayData) {
        return {
          cost: todayData.totalCost,
          inputTokens: todayData.inputTokens,
          outputTokens: todayData.outputTokens,
        };
      }

      // No data for today
      return { cost: 0, inputTokens: 0, outputTokens: 0 };
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
