/**
 * Pricing data fetcher with daily caching
 *
 * Fetches model pricing from Anthropic's docs page and caches locally.
 * Uses stale-while-revalidate: returns stale data while one process refreshes.
 *
 * Model ID mapping:
 * - 4.x models: "Claude Opus 4.6" → "claude-opus-4-6" (direct conversion)
 * - 3.x models: "Claude Sonnet 3.7" → also registers "claude-3-7-sonnet" (old naming)
 * - Dated variants (e.g., "claude-sonnet-4-5-20250929") resolved by stripping suffix
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ModelPricing {
  input: number;
  output: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
}

interface PricingCacheData {
  models: Record<string, ModelPricing>;
  fetchedAt: number;
}

const CACHE_DIR = join(homedir(), '.cache', 'chud');
const PRICING_CACHE_FILE = join(CACHE_DIR, 'pricing.json');
const PRICING_URL = 'https://platform.claude.com/docs/en/about-claude/pricing';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 10_000;
const REFRESH_LOCK_TIMEOUT_MS = 30_000;

/**
 * Convert display name to all likely API model IDs.
 *
 * "Claude Opus 4.6"   → ["claude-opus-4-6"]
 * "Claude Opus 4"     → ["claude-opus-4", "claude-opus-4-0"]
 * "Claude Sonnet 3.7" → ["claude-sonnet-3-7", "claude-3-7-sonnet", "claude-3-7-sonnet-latest"]
 */
function displayNameToModelIds(displayName: string): string[] {
  const normalized = displayName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-');

  const ids = [normalized];

  // Whole major version: "claude-opus-4" → also "claude-opus-4-0"
  if (/^claude-\w+-\d+$/.test(normalized)) {
    ids.push(normalized + '-0');
  }

  // 3.x models use reversed naming: "claude-sonnet-3-7" → "claude-3-7-sonnet"
  const match = normalized.match(/^claude-(\w+)-(3.*)$/);
  if (match) {
    const [, tier, version] = match;
    ids.push(`claude-${version}-${tier}`);
    ids.push(`claude-${version}-${tier}-latest`);
  }

  return ids;
}

/**
 * Extract dollar amount from a cell like "$5 / MTok"
 */
function parsePrice(cell: string): number | null {
  const match = cell.match(/\$(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse the pricing HTML and extract the model pricing table.
 * Looks for rows with 6 cells: [Model, Input, 5m Cache, 1h Cache, Cache Read, Output]
 */
function parsePricingPage(html: string): Record<string, ModelPricing> {
  const result: Record<string, ModelPricing> = {};
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];

    cellRegex.lastIndex = 0;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    if (cells.length >= 6 && cells[0].toLowerCase().startsWith('claude')) {
      const displayName = cells[0].replace(/\s*\([^)]*\)\s*/g, '').trim();

      const input = parsePrice(cells[1]);
      const output = parsePrice(cells[5]);
      if (input === null || output === null) continue;

      const pricing: ModelPricing = {
        input,
        output,
        cache_write_5m: parsePrice(cells[2]) ?? input * 1.25,
        cache_write_1h: parsePrice(cells[3]) ?? input * 2,
        cache_read: parsePrice(cells[4]) ?? input * 0.1,
      };

      for (const id of displayNameToModelIds(displayName)) {
        result[id] = pricing;
      }
    }
  }

  return result;
}

async function fetchPricingFromWeb(): Promise<Record<string, ModelPricing> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(PRICING_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const pricing = parsePricingPage(html);

    // Sanity check: page should have multiple models
    if (Object.keys(pricing).length < 3) return null;

    return pricing;
  } catch {
    return null;
  }
}

// --- Cache management (stale-while-revalidate) ---

function loadPricingCache(): { data: PricingCacheData | null; fresh: boolean } {
  try {
    if (!existsSync(PRICING_CACHE_FILE)) return { data: null, fresh: false };

    const cached: PricingCacheData = JSON.parse(
      readFileSync(PRICING_CACHE_FILE, 'utf-8')
    );

    const fresh = Date.now() - cached.fetchedAt < CACHE_TTL_MS;
    return { data: cached, fresh };
  } catch {
    return { data: null, fresh: false };
  }
}

function savePricingCache(data: PricingCacheData): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(PRICING_CACHE_FILE, JSON.stringify(data));
  } catch {
    // Ignore cache write errors
  }
}

function tryAcquireRefreshLock(): boolean {
  const lockFile = PRICING_CACHE_FILE + '.refreshing';
  try {
    if (existsSync(lockFile)) {
      const stat = statSync(lockFile);
      if (Date.now() - stat.mtimeMs < REFRESH_LOCK_TIMEOUT_MS) {
        return false;
      }
    }
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(lockFile, String(process.pid));
    return true;
  } catch {
    return false;
  }
}

function releaseRefreshLock(): void {
  const lockFile = PRICING_CACHE_FILE + '.refreshing';
  try {
    unlinkSync(lockFile);
  } catch {
    // Ignore
  }
}

/**
 * Load pricing with stale-while-revalidate caching.
 * Returns pricing map keyed by API model ID, or null if unavailable.
 */
export async function loadPricing(): Promise<Record<string, ModelPricing> | null> {
  const { data: cached, fresh } = loadPricingCache();

  if (fresh && cached) return cached.models;

  // Stale or missing — try to refresh
  if (tryAcquireRefreshLock()) {
    try {
      const freshPricing = await fetchPricingFromWeb();
      if (freshPricing) {
        savePricingCache({ models: freshPricing, fetchedAt: Date.now() });
        return freshPricing;
      }
    } finally {
      releaseRefreshLock();
    }
  }

  return cached?.models ?? null;
}

/**
 * Look up pricing for an API model ID.
 * Handles dated variants by stripping the -YYYYMMDD suffix.
 */
export function lookupModelPricing(
  pricing: Record<string, ModelPricing>,
  modelId: string
): ModelPricing | null {
  if (pricing[modelId]) return pricing[modelId];

  // Strip date suffix: "claude-sonnet-4-5-20250929" → "claude-sonnet-4-5"
  const withoutDate = modelId.replace(/-\d{8}$/, '');
  if (withoutDate !== modelId && pricing[withoutDate]) {
    return pricing[withoutDate];
  }

  return null;
}
