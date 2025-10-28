/**
 * Thoughts segment - Shows contextual "thoughts" based on coding activity
 * Combines contextual reactions with random thought rotation
 */

import type { ClaudeCodeInput, ThoughtsSegmentConfig } from '../config';
import type { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';

/**
 * Default thought pool for random rotation
 */
const DEFAULT_THOUGHTS = [
  "Let's build something cool",
  "Coffee first, code later",
  "One bug at a time",
  "Keep it simple",
  "Ship it!",
  "This could be cleaner...",
  "Time to refactor?",
  "Documentation? What's that?",
  "Works on my machine",
  "TODO: fix this properly",
];

export class ThoughtsSegment extends Segment {
  protected config: ThoughtsSegmentConfig;

  constructor(config: ThoughtsSegmentConfig) {
    super(config);
    this.config = config;
  }

  /**
   * Get current hour (0-23)
   */
  private getCurrentHour(): number {
    return new Date().getHours();
  }

  /**
   * Get a random thought from the pool
   */
  private getRandomThought(): string {
    const thoughts = this.config.customThoughts ?? DEFAULT_THOUGHTS;
    const index = Math.floor(Math.random() * thoughts.length);
    return thoughts[index];
  }

  /**
   * Get contextual thought based on session state
   */
  private getContextualThought(
    input: ClaudeCodeInput,
    db: DatabaseClient
  ): string | null {
    // Check time of day
    const hour = this.getCurrentHour();
    if (hour >= 22 || hour < 6) {
      return hour >= 22 ? "Late night coding?" : "Early bird!";
    }

    // Check git status
    if (input.git) {
      if (input.git.isDirty) {
        return "Hmm, lots of changes...";
      } else {
        // Clean git occasionally shows this
        if (Math.random() < 0.3) {
          return "Clean slate!";
        }
      }

      // Check ahead/behind
      if (input.git.ahead && input.git.ahead > 0) {
        return "Ready to push!";
      }
    }

    // Check daily cost (get today's summary from DB)
    const todayDate = DatabaseClient.getTodayDate();
    const summary = db.getDailySummary(todayDate);

    if (summary) {
      if (summary.total_cost > 10) {
        return "Burning through tokens...";
      } else if (summary.total_cost < 1) {
        return "Just getting started";
      }
    }

    // No strong contextual match
    return null;
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    // Try to get contextual thought first, fallback to random
    let thought = this.getContextualThought(input, db);
    if (!thought) {
      thought = this.getRandomThought();
    }

    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('💭');
    }

    // Add thought with optional quotes
    if (display.quotes) {
      parts.push(`"${thought}"`);
    } else {
      parts.push(thought);
    }

    return {
      text: parts.join(' '),
      colors,
    };
  }
}
