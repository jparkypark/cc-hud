/**
 * Database types
 */

export interface DailySummary {
  date: string;
  total_sessions: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_tokens: number;
  total_cost: number;
  models_used: string; // JSON array
  updated_at?: string;
}
