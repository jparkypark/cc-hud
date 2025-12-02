/**
 * Hourly burn rate calculator
 * Reads JSONL transcript files to calculate usage for the last hour
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface HourlyUsage {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  apiCalls: number;
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
    console.error(`[cc-hud] Unknown model for pricing: ${model}`);
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
 */
export async function calculateHourlyBurnRate(): Promise<HourlyUsage> {
  const projectsDir = join(homedir(), '.claude', 'projects');
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  // Find all JSONL files modified in the last hour
  const recentFiles: string[] = [];
  const entries = readdirSync(projectsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectPath = join(projectsDir, entry.name);
    const files = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      const filePath = join(projectPath, file);
      const stats = statSync(filePath);
      if (stats.mtimeMs > oneHourAgo) {
        recentFiles.push(filePath);
      }
    }
  }

  // Calculate costs for entries in the last hour
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheTokens = 0;
  let apiCalls = 0;

  for (const filePath of recentFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const entryTime = new Date(entry.timestamp).getTime();

        if (entryTime > oneHourAgo && entry.message?.usage) {
          // Calculate cost
          const cost = calculateEntryCost(entry);
          totalCost += cost;

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

  return {
    cost: totalCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheTokens: totalCacheTokens,
    apiCalls,
  };
}
