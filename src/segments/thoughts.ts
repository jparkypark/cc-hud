/**
 * Thoughts segment - Shows contextual "thoughts" based on coding activity
 * Combines contextual reactions with random thought rotation
 */

import type { ClaudeCodeInput, ThoughtsSegmentConfig } from '../config';
import { DatabaseClient } from '../database';
import { Segment, type SegmentData } from './base';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const CACHE_DIR = join(homedir(), '.cache', 'cc-hud');
const THOUGHTS_STATE_FILE = join(CACHE_DIR, 'thoughts-state.json');
const QUOTES_CACHE_FILE = join(CACHE_DIR, 'quotes-cache.json');

interface ThoughtsState {
  lastThought: string;
  lastUpdate: number;
}

interface QuotesCache {
  quotes: string[];
  lastFetch: number;
}

// Cache quotes for 1 hour
const QUOTES_CACHE_DURATION = 60 * 60 * 1000;

/**
 * Default dev thought pool
 */
const DEV_THOUGHTS = [
  "Let's build something cool",
  "Ship it!",
  "Works on my machine",
  "TODO: fix this properly",
  "Move fast, break things",
  "Debug mode activated",
  "Iteration over perfection",
  "Make it work, then make it pretty",
  "git commit -m 'stuff'",
  "Premature optimization is evil",
  "Have you tried explaining it to the rubber ducky?",
  "It's not a bug, it's a feature",
  "Nothing is as permanent as a temporary solution that works",
  "If one programmer can do it in one week, then 2 programmers can do it in 2 weeks",
  "We do things not because they are easy, but because we thought they would be easy",
  "Trust the process",
  "Making the world a better place",
  "You just brought piss to a shit fight you little fuck",
  "This guy fucks",
  "Tres commas",
  "Not Hotdog",
  "I don't want to live in a world where someone else makes the world a better place better than we do",
  "The code was working perfectly until I started testing it",
  "99 little bugs in the code, 99 little bugs. Take one down, patch it around, 127 little bugs in the code",
  "I don't always test my code, but when I do, I do it in production",
  "First, solve the problem. Then, write the code. Then, fix what you broke",
  "Technical debt is just early retirement for your future self",
  "There's no problem that can't be solved by adding another layer of abstraction",
  "Sometimes the best code is no code at all. Unfortunately, that's not what they're paying us for",
  "The only thing more expensive than writing tests is not writing tests",
  "I'm not saying it's impossible, I'm just saying it'll take 3 months and you want it in 2 weeks",
  "A week of coding can save you an hour of planning",
  "It'll be ready when it's ready, which is definitely not when I said it would be ready",
  "It's always DNS. Except when it's not. Then it's the cache",
  "Everyone has a testing environment. Some people are lucky enough to have a separate production environment",
  "The best debugger is 20 years of experience. The second best is print statements",
  "Code never lies, comments sometimes do",
  "Any code that hasn't been looked at in 6 months might as well have been written by someone else",
  "Refactoring: making code better without making it work better",
];

/**
 * Contextual thought variations
 */
const CONTEXTUAL_THOUGHTS = {
  lateNight: [
    "Late night coding?",
    "Burning the midnight oil",
    "Night owl mode activated",
    "The bugs never sleep",
  ],
  earlyBird: [
    "Early bird!",
    "Morning code session",
    "Fresh start to the day",
    "Coffee and code time",
  ],
  dirty: [
    "Hmm, lots of changes...",
    "Things are getting messy",
    "Refactoring in progress?",
    "Work in progress",
  ],
  clean: [
    "Clean slate!",
    "All tidy now",
    "Fresh and clean",
    "Everything committed",
  ],
  ahead: [
    "Ready to push!",
    "Time to ship it",
    "Commits waiting",
    "Let's deploy this",
  ],
  highUsage: [
    "Burning through tokens...",
    "Claude's working overtime",
    "Productive day!",
    "AI-powered productivity",
  ],
  lowUsage: [
    "Just getting started",
    "Taking it easy today",
    "Warming up",
    "Light session",
  ],
};

export class ThoughtsSegment extends Segment {
  protected config: ThoughtsSegmentConfig;
  private state: ThoughtsState;
  private quotesCache: QuotesCache | null = null;

  constructor(config: ThoughtsSegmentConfig) {
    super(config);
    this.config = config;
    this.state = this.loadState();

    // Load quotes cache if API quotes are enabled
    if (this.config.useApiQuotes) {
      this.quotesCache = this.loadQuotesCache();
    }
  }

  /**
   * Load thoughts state from cache file
   */
  private loadState(): ThoughtsState {
    try {
      if (existsSync(THOUGHTS_STATE_FILE)) {
        const data = readFileSync(THOUGHTS_STATE_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[cc-hud] Failed to load thoughts state:', error);
    }

    // Default state
    return {
      lastThought: '',
      lastUpdate: Date.now(),
    };
  }

  /**
   * Save thoughts state to cache file
   */
  private saveState(): void {
    try {
      // Ensure cache directory exists
      if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
      }

      writeFileSync(THOUGHTS_STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('[cc-hud] Failed to save thoughts state:', error);
    }
  }

  /**
   * Load quotes cache from file
   */
  private loadQuotesCache(): QuotesCache {
    try {
      if (existsSync(QUOTES_CACHE_FILE)) {
        const data = readFileSync(QUOTES_CACHE_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[cc-hud] Failed to load quotes cache:', error);
    }

    return {
      quotes: [],
      lastFetch: 0,
    };
  }

  /**
   * Save quotes cache to file
   */
  private saveQuotesCache(cache: QuotesCache): void {
    try {
      if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
      }

      writeFileSync(QUOTES_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('[cc-hud] Failed to save quotes cache:', error);
    }
  }

  /**
   * Fetch quotes from zenquotes.io API
   */
  private async fetchApiQuotes(): Promise<string[]> {
    try {
      // Fetch 5 random quotes
      const response = await fetch('https://zenquotes.io/api/quotes');

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json() as Array<{ q: string; a: string }>;

      // Format: [{ q: "quote text", a: "author" }, ...]
      return data.map((item) => `${item.q} - ${item.a}`);
    } catch (error) {
      console.error('[cc-hud] Failed to fetch quotes from API:', error);
      return [];
    }
  }

  /**
   * Update quotes cache (call this before render)
   */
  async updateCache(): Promise<void> {
    if (!this.config.useApiQuotes || !this.quotesCache) {
      return;
    }

    // Check if cache is still valid
    const now = Date.now();
    const cacheAge = now - this.quotesCache.lastFetch;

    if (cacheAge > QUOTES_CACHE_DURATION || this.quotesCache.quotes.length === 0) {
      // Cache expired or empty, fetch new quotes
      const quotes = await this.fetchApiQuotes();

      if (quotes.length > 0) {
        this.quotesCache = {
          quotes,
          lastFetch: now,
        };
        this.saveQuotesCache(this.quotesCache);
      }
    }
  }

  /**
   * Get a quote from API cache (synchronous)
   */
  private getApiQuote(): string | null {
    if (!this.quotesCache || this.quotesCache.quotes.length === 0) {
      return null;
    }

    // Return a random quote from cache (avoiding last thought)
    const availableQuotes = this.quotesCache.quotes.filter(
      q => q !== this.state.lastThought
    );

    const pool = availableQuotes.length > 0 ? availableQuotes : this.quotesCache.quotes;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * Get current hour (0-23)
   */
  private getCurrentHour(): number {
    return new Date().getHours();
  }

  /**
   * Get a dev thought from the pool (avoiding the last one shown)
   */
  private getDevThought(): string {
    const thoughts = this.config.customThoughts ?? DEV_THOUGHTS;

    // Filter out the last thought to avoid repeats
    const availableThoughts = thoughts.filter(t => t !== this.state.lastThought);

    // If we filtered everything out (shouldn't happen unless pool size is 1), use full pool
    const pool = availableThoughts.length > 0 ? availableThoughts : thoughts;

    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * Pick a random thought from an array (avoiding the last thought)
   */
  private pickRandomThought(thoughts: string[]): string {
    const availableThoughts = thoughts.filter(t => t !== this.state.lastThought);
    const pool = availableThoughts.length > 0 ? availableThoughts : thoughts;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * Get contextual thought based on session state (with RNG for variety)
   */
  private getContextualThought(
    input: ClaudeCodeInput,
    db: DatabaseClient
  ): string | null {
    // Check time of day (70% chance to show)
    const hour = this.getCurrentHour();
    if (hour >= 22 || hour < 6) {
      if (Math.random() < 0.7) {
        const thoughts = hour >= 22 ? CONTEXTUAL_THOUGHTS.lateNight : CONTEXTUAL_THOUGHTS.earlyBird;
        return this.pickRandomThought(thoughts);
      }
    }

    // Check git status
    if (input.git) {
      // Dirty repo (50% chance to show)
      if (input.git.isDirty && Math.random() < 0.5) {
        return this.pickRandomThought(CONTEXTUAL_THOUGHTS.dirty);
      }

      // Clean git (30% chance to show)
      if (!input.git.isDirty && Math.random() < 0.3) {
        return this.pickRandomThought(CONTEXTUAL_THOUGHTS.clean);
      }

      // Commits ahead (60% chance to show)
      if (input.git.ahead && input.git.ahead > 0 && Math.random() < 0.6) {
        return this.pickRandomThought(CONTEXTUAL_THOUGHTS.ahead);
      }
    }

    // Check daily cost (get today's summary from DB)
    const todayDate = DatabaseClient.getTodayDate();
    const summary = db.getDailySummary(todayDate);

    if (summary) {
      // High usage (60% chance to show)
      if (summary.total_cost > 10 && Math.random() < 0.6) {
        return this.pickRandomThought(CONTEXTUAL_THOUGHTS.highUsage);
      }

      // Low usage (40% chance to show)
      if (summary.total_cost < 1 && Math.random() < 0.4) {
        return this.pickRandomThought(CONTEXTUAL_THOUGHTS.lowUsage);
      }
    }

    // No strong contextual match
    return null;
  }

  render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData {
    const { display, colors } = this.config;

    let thought: string;

    // Decide which category to pick from: contextual, dev thought, or API quote
    // Equal probability (1/3 each) when API quotes are enabled
    const rand = Math.random();
    let useContextual = false;
    let useApiQuote = false;

    if (this.config.useApiQuotes) {
      // Three categories: contextual, dev thought, API quote (1/3 each)
      if (rand < 0.33) {
        useContextual = true;
      } else if (rand < 0.66) {
        useApiQuote = true;
      }
      // else: use dev thought (default)
    } else {
      // Two categories: contextual, dev thought (1/2 each)
      useContextual = rand < 0.5;
    }

    // Try contextual thought if selected
    if (useContextual) {
      const contextualThought = this.getContextualThought(input, db);
      if (contextualThought) {
        thought = contextualThought;
      } else {
        // Fallback to dev thought if no contextual match
        thought = this.getDevThought();
      }
    } else if (useApiQuote) {
      // Try API quote if selected
      const apiQuote = this.getApiQuote();
      thought = apiQuote || this.getDevThought();
    } else {
      // Use dev thought
      thought = this.getDevThought();
    }

    // Save state to avoid repeating this thought
    this.state.lastThought = thought;
    this.state.lastUpdate = Date.now();
    this.saveState();

    const parts: string[] = [];

    // Add icon if enabled
    if (display.icon) {
      parts.push('◇');  // White diamond
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
      allowWrap: true,  // Thoughts can be long, allow internal word-wrap
    };
  }
}
