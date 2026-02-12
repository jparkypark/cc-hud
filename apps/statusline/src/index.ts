#!/usr/bin/env bun

/**
 * chud - Customizable heads-up display for Claude Code
 */

import { loadConfig } from './config';
import { DatabaseClient } from './database';
import { createSegment } from './segments';
import { renderPowerline } from './renderer';
import { UsageSegment } from './segments/usage';
import { PaceSegment } from './segments/pace';

/**
 * Read JSON from stdin
 */
async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  return buffer.toString('utf-8');
}

/**
 * Main function
 */
async function main() {
  try {
    // 1. Read input from Claude Code (via stdin), or skip in standalone mode
    const standalone = process.argv.includes('--standalone');
    let sessionData: Record<string, unknown> = {};

    if (!standalone) {
      const input = await readStdin();
      sessionData = input ? JSON.parse(input) : {};
    }

    // Parse --cache-ttl <seconds> flag (overrides per-segment cacheTtlMinutes)
    const cacheTtlIdx = process.argv.indexOf('--cache-ttl');
    const cacheTtlOverrideMs = cacheTtlIdx !== -1 && process.argv[cacheTtlIdx + 1]
      ? Number(process.argv[cacheTtlIdx + 1]) * 1000
      : undefined;

    // 2. Load configuration
    const config = loadConfig();

    // 3. Initialize database connection
    const db = new DatabaseClient();

    // Periodically cleanup old sessions (1% probability = ~every 100 renders)
    if (Math.random() < 0.01) {
      db.cleanupOldSessions(7);
    }

    // 4. Create segments
    const segments = config.segments.map((segmentConfig) =>
      createSegment(segmentConfig)
    );

    if (standalone) {
      // Standalone mode (ticker): compute fresh usage/pace data and persist to DB.
      // This is the single source of truth for usage data.
      const usageSegment = new UsageSegment({
        type: 'usage',
        display: { icon: false, cost: false, tokens: false, period: 'today', cacheTtlMinutes: 1 },
        colors: { fg: '', bg: '' },
      });
      const paceSegment = new PaceSegment({
        type: 'pace',
        display: { icon: false, period: 'hourly', halfLifeMinutes: 60 },
        colors: { fg: '', bg: '' },
      });

      await Promise.all([
        usageSegment.updateCache(cacheTtlOverrideMs),
        paceSegment.updateCache(),
      ]);

      const usageData = usageSegment.getCachedData();
      if (usageData) {
        db.recordDailyUsage(usageData.date, usageData.cost, usageData.inputTokens, usageData.outputTokens);
        db.recordUsageSnapshot(usageData.cost);
      }

      const pace = paceSegment.getCachedPace();
      if (pace !== null) {
        db.recordPaceSnapshot(pace);
      }
    } else {
      // Normal mode (statusline): load async data for non-usage/pace segments only.
      // Usage and pace segments read from DB (populated by the ticker).
      await Promise.all(
        segments.map(async (segment) => {
          if (segment instanceof UsageSegment || segment instanceof PaceSegment) return;
          if ('updateCache' in segment && typeof segment.updateCache === 'function') {
            await segment.updateCache(cacheTtlOverrideMs);
          }
        })
      );

      // Hydrate usage/pace segments from DB if they're in the config
      for (const segment of segments) {
        if (segment instanceof UsageSegment) {
          segment.loadFromDb(db);
        }
        if (segment instanceof PaceSegment) {
          segment.loadFromDb(db);
        }
      }
    }

    // 6. Render each segment
    const segmentDataList = segments.map((segment) =>
      segment.render(sessionData, db)
    );

    // 7. Apply powerline styling
    const statusline = renderPowerline(segmentDataList, config.theme);

    // 8. Output to stdout
    console.log(statusline);

    // 9. Close database connection
    db.close();
  } catch (error) {
    // Log errors to stderr (not stdout, to avoid breaking statusline)
    console.error('[chud] Error:', error);

    // Output empty string on error (graceful degradation)
    console.log('');

    process.exit(1);
  }
}

// Run main function
main();
