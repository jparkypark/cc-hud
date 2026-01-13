/**
 * Hourly burn rate calculator
 * Reads JSONL transcript files to calculate usage for the last hour
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface HourlyUsage {
  cost: number;
  pace: number;  // EWMA-smoothed $/hr rate
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  apiCalls: number;
  activeMinutes: number;  // Minutes since first activity in window
}

export interface PaceOptions {
  halfLifeMinutes?: number;  // EWMA half-life in minutes (default: 7)
}

interface TimestampedCost {
  timestamp: number;
  cost: number;
}

// Pricing per million tokens (from Anthropic's official pricing)
// Cache pricing: 5min = 1.25x base, 1hr = 2x base, read = 0.1x base
const PRICING: Record<string, {
  input: number;
  output: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
}> = {
  // Opus 4.5 models
  'claude-opus-4-5-20251101': {
    input: 5,
    output: 25,
    cache_write_5m: 6.25,
    cache_write_1h: 10,
    cache_read: 0.5,
  },
  'claude-opus-4-5': {
    input: 5,
    output: 25,
    cache_write_5m: 6.25,
    cache_write_1h: 10,
    cache_read: 0.5,
  },
  // Sonnet 4.5 models
  'claude-sonnet-4-5-20250929': {
    input: 3,
    output: 15,
    cache_write_5m: 3.75,
    cache_write_1h: 6,
    cache_read: 0.3,
  },
  'claude-sonnet-4-5': {
    input: 3,
    output: 15,
    cache_write_5m: 3.75,
    cache_write_1h: 6,
    cache_read: 0.3,
  },
  // Haiku 4.5 models
  'claude-haiku-4-5-20251001': {
    input: 1,
    output: 5,
    cache_write_5m: 1.25,
    cache_write_1h: 2,
    cache_read: 0.1,
  },
  'claude-haiku-4-5': {
    input: 1,
    output: 5,
    cache_write_5m: 1.25,
    cache_write_1h: 2,
    cache_read: 0.1,
  },
  // Legacy 3.5 models
  'claude-3-5-sonnet-20241022': {
    input: 3,
    output: 15,
    cache_write_5m: 3.75,
    cache_write_1h: 6,
    cache_read: 0.3,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8,
    output: 4,
    cache_write_5m: 1,
    cache_write_1h: 1.6,
    cache_read: 0.08,
  },
};

/**
 * Calculate EWMA pace from timestamped costs
 *
 * Uses exponential decay weighting where recent costs have more influence.
 * The half-life determines how quickly older costs fade:
 * - At 1 half-life ago: weight = 0.5
 * - At 2 half-lives ago: weight = 0.25
 * - At 3 half-lives ago: weight = 0.125
 *
 * The pace is calculated by summing weighted costs and dividing by the
 * "effective time window" which is approximately 1.44 × halfLife.
 */
function calculateEWMAPace(
  costs: TimestampedCost[],
  halfLifeMs: number,
  now: number
): number {
  if (costs.length === 0) return 0;

  // Weight each cost by recency using exponential decay
  let weightedCostSum = 0;

  for (const { timestamp, cost } of costs) {
    const ageMs = now - timestamp;
    // Weight = 2^(-age / halfLife), so recent ≈ 1, old → 0
    const weight = Math.pow(2, -ageMs / halfLifeMs);
    weightedCostSum += cost * weight;
  }

  // The integral of 2^(-t/h) from 0 to ∞ is h / ln(2) ≈ 1.44 × h
  // This gives us the "effective window" for normalization
  const effectiveWindowMs = halfLifeMs / Math.LN2;
  const effectiveWindowHours = effectiveWindowMs / (1000 * 60 * 60);

  // Pace in $/hr
  return weightedCostSum / effectiveWindowHours;
}

/**
 * Calculate cost for a single transcript entry
 */
function calculateEntryCost(entry: any): number {
  const model = entry.message?.model;
  const usage = entry.message?.usage;

  if (!model || !usage) {
    return 0;
  }

  const pricing = PRICING[model];
  if (!pricing) {
    console.error(`[cchud] Unknown model for pricing: ${model}`);
    return 0;
  }

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  // Cache tokens: determine type based on field name
  let cacheWriteTokens5m = 0;
  let cacheWriteTokens1h = 0;
  let cacheReadTokens = 0;

  if (usage.cache_creation) {
    cacheWriteTokens5m = usage.cache_creation.ephemeral_5m_input_tokens || 0;
    cacheWriteTokens1h = usage.cache_creation.ephemeral_1h_input_tokens || 0;
  }
  cacheReadTokens = usage.cache_read_input_tokens || 0;

  // Calculate cost (prices are per million tokens, so divide by 1,000,000)
  const cost =
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000 +
    (cacheWriteTokens5m * pricing.cache_write_5m) / 1_000_000 +
    (cacheWriteTokens1h * pricing.cache_write_1h) / 1_000_000 +
    (cacheReadTokens * pricing.cache_read) / 1_000_000;

  return cost;
}

/**
 * Calculate usage for the last hour by reading JSONL transcripts
 * Uses EWMA (Exponential Weighted Moving Average) for pace calculation
 *
 * TODO: Consider adding Codex CLI usage to pace calculation.
 * Currently only tracks Claude Code usage. Codex is ~4% of total cost,
 * so impact is small, but may be worth adding for completeness.
 * See: bunx @ccusage/codex@latest daily --json
 */
export async function calculatePace(options: PaceOptions = {}): Promise<HourlyUsage> {
  const { halfLifeMinutes = 7 } = options;
  const halfLifeMs = halfLifeMinutes * 60 * 1000;

  const projectsDir = join(homedir(), '.claude', 'projects');
  const now = Date.now();
  // Look back further than the half-life to capture decaying costs
  // 6 half-lives gives us 98.4% of the weight (2^-6 ≈ 0.016)
  const lookbackMs = Math.max(halfLifeMs * 6, 60 * 60 * 1000);
  const cutoffTime = now - lookbackMs;

  // Find all JSONL files modified within the lookback window
  const recentFiles: string[] = [];

  // Handle fresh installs where ~/.claude/projects doesn't exist yet
  if (!existsSync(projectsDir)) {
    return {
      cost: 0,
      pace: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      apiCalls: 0,
      activeMinutes: 0,
    };
  }

  const dirEntries = readdirSync(projectsDir, { withFileTypes: true });

  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) continue;

    const projectPath = join(projectsDir, dirEntry.name);
    const files = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      const filePath = join(projectPath, file);
      const stats = statSync(filePath);
      if (stats.mtimeMs > cutoffTime) {
        recentFiles.push(filePath);
      }
    }
  }

  // Collect timestamped costs for EWMA and aggregate totals
  const timestampedCosts: TimestampedCost[] = [];
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheTokens = 0;
  let apiCalls = 0;
  let earliestTimestamp = Infinity;

  for (const filePath of recentFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const entryTime = new Date(entry.timestamp).getTime();

        if (entryTime > cutoffTime && entry.message?.usage) {
          // Track earliest activity
          if (entryTime < earliestTimestamp) {
            earliestTimestamp = entryTime;
          }

          // Calculate cost
          const cost = calculateEntryCost(entry);
          totalCost += cost;

          // Collect for EWMA calculation
          if (cost > 0) {
            timestampedCosts.push({ timestamp: entryTime, cost });
          }

          // Sum tokens
          const usage = entry.message.usage;
          totalInputTokens += usage.input_tokens || 0;
          totalOutputTokens += usage.output_tokens || 0;

          // Sum cache tokens
          let cacheTokens = 0;
          if (usage.cache_creation) {
            cacheTokens += usage.cache_creation.ephemeral_5m_input_tokens || 0;
            cacheTokens += usage.cache_creation.ephemeral_1h_input_tokens || 0;
          }
          cacheTokens += usage.cache_read_input_tokens || 0;
          totalCacheTokens += cacheTokens;

          apiCalls++;
        }
      } catch (e) {
        // Skip invalid lines
        continue;
      }
    }
  }

  // Calculate EWMA-smoothed pace
  const pace = calculateEWMAPace(timestampedCosts, halfLifeMs, now);

  // Calculate active time for reporting
  const activeMs = earliestTimestamp === Infinity ? 0 : now - earliestTimestamp;
  const activeMinutes = activeMs / (1000 * 60);

  return {
    cost: totalCost,
    pace,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheTokens: totalCacheTokens,
    apiCalls,
    activeMinutes,
  };
}
