/**
 * Database client for querying Claude's statusline-usage.db
 */

import { Database } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import type { DailySummary } from './types';

const DB_PATH = join(homedir(), '.claude', 'statusline-usage.db');

export class DatabaseClient {
  private db: Database | null = null;

  constructor(dbPath?: string) {
    const path = dbPath || DB_PATH;

    // Check if database exists
    if (!existsSync(path)) {
      console.error(`[cc-hud] Database not found at ${path}`);
      return;
    }

    try {
      this.db = new Database(path, { readonly: true });
    } catch (error) {
      console.error(`[cc-hud] Failed to open database: ${error}`);
    }
  }

  /**
   * Get daily summary for a specific date
   * Note: Calculates from sessions table for accuracy (matches ccusage)
   */
  getDailySummary(date: string): DailySummary | null {
    if (!this.db) {
      return null;
    }

    try {
      // Calculate from sessions table using start_time (when API call happened)
      // This gives accurate daily totals even with long-running sessions
      const query = this.db.query<{
        total_cost: number;
        total_input_tokens: number;
        total_output_tokens: number;
        total_cache_tokens: number;
      }, [string]>(`
        SELECT
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(SUM(input_tokens), 0) as total_input_tokens,
          COALESCE(SUM(output_tokens), 0) as total_output_tokens,
          COALESCE(SUM(cache_tokens), 0) as total_cache_tokens
        FROM sessions
        WHERE date(start_time, 'localtime') = ?
      `);

      const result = query.get(date);

      if (!result) {
        return null;
      }

      return {
        date,
        total_sessions: 0,  // Not calculated
        total_input_tokens: result.total_input_tokens,
        total_output_tokens: result.total_output_tokens,
        total_cache_tokens: result.total_cache_tokens,
        total_cost: result.total_cost,
        models_used: '[]',  // Not calculated
      };
    } catch (error) {
      console.error(`[cc-hud] Failed to query daily summary: ${error}`);
      return null;
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  static getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null;
  }
}
