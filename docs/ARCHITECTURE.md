# Architecture

This document describes the technical implementation of cc-hud.

## Overview

cc-hud is a command-line tool that:
1. Receives JSON input from Claude Code via stdin
2. Reads configuration from `~/.claude/cc-hud.json`
3. Fetches usage data from ccusage library and Codex CLI
4. Calculates EWMA-smoothed pace from transcript files
5. Renders segments with powerline or text-mode styling
6. Outputs a single line of ANSI-colored text to stdout

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Code                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Sends JSON via stdin                                    │ │
│ │ { "cwd": "/path", "git": {...}, "session": {...} }      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ cc-hud (src/index.ts)                                       │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│ │ Config Parser   │  │ ccusage Library │  │ Codex CLI    │ │
│ │ (config/)       │  │ (daily usage)   │  │ (via bunx)   │ │
│ │                 │  │                 │  │              │ │
│ │ ~/.claude/      │  │ JSONL           │  │ @ccusage/    │ │
│ │ cc-hud.json     │  │ transcripts     │  │ codex        │ │
│ └─────────────────┘  └─────────────────┘  └──────────────┘ │
│          │                    │                  │          │
│          └────────────────────┼──────────────────┘          │
│                               ▼                             │
│                    ┌──────────────────┐                     │
│                    │ Segment System   │                     │
│                    │ (segments/)      │                     │
│                    │                  │                     │
│                    │ - UsageSegment   │                     │
│                    │ - PaceSegment    │                     │
│                    │ - DirectorySegment│                    │
│                    │ - GitSegment     │                     │
│                    │ - PrSegment      │                     │
│                    │ - TimeSegment    │                     │
│                    │ - ThoughtsSegment│                     │
│                    └──────────────────┘                     │
│                               │                             │
│                               ▼                             │
│                    ┌──────────────────┐                     │
│                    │ Powerline        │                     │
│                    │ Renderer         │                     │
│                    │ (renderer/)      │                     │
│                    └──────────────────┘                     │
│                               │                             │
└───────────────────────────────┼─────────────────────────────┘
                                ▼
                  ANSI-colored string to stdout
           "› repos/cc-hud | ⎇ main ✗ | Σ $240 today | ..."
```

## Project Structure

```
cc-hud/
├── src/
│   ├── index.ts              # Main entry point
│   ├── segments/
│   │   ├── base.ts           # Segment interface
│   │   ├── usage.ts          # Daily cost (ccusage + Codex)
│   │   ├── pace.ts           # EWMA hourly burn rate
│   │   ├── directory.ts      # Current path display
│   │   ├── git.ts            # Git repository status
│   │   ├── git-utils.ts      # Git helper functions
│   │   ├── pr.ts             # GitHub PR segment
│   │   ├── pr-utils.ts       # PR helper functions
│   │   ├── time.ts           # Current time display
│   │   ├── thoughts.ts       # Random quotes/thoughts
│   │   └── index.ts          # Segment registry
│   ├── usage/
│   │   └── hourly-calculator.ts  # EWMA pace calculation
│   ├── config/
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── parser.ts         # Config file parser
│   │   ├── validator.ts      # Config validation
│   │   ├── defaults.ts       # Default configuration
│   │   └── index.ts          # Config exports
│   ├── database/
│   │   ├── client.ts         # SQLite connection (legacy)
│   │   └── index.ts          # Database exports
│   └── renderer/
│       ├── powerline.ts      # Powerline/text-mode rendering
│       ├── separators.ts     # Separator character definitions
│       └── index.ts          # Renderer exports
├── docs/
│   ├── DESIGN.md             # Design decisions
│   └── ARCHITECTURE.md       # This file
├── package.json
├── tsconfig.json
└── README.md
```

## Core Components

### 1. Main Entry Point (src/index.ts)

```typescript
#!/usr/bin/env bun

async function main() {
  // 1. Read stdin from Claude Code
  const input = await readStdin();
  const sessionData = JSON.parse(input);

  // 2. Load and validate config
  const config = await loadConfig();

  // 3. Create segment instances
  const segments = config.segments.map(segmentConfig =>
    createSegment(segmentConfig)
  );

  // 4. Update async caches (usage, pace, etc.) in parallel
  await Promise.all(
    segments.map(async segment => {
      if ('updateCache' in segment) {
        await segment.updateCache();
      }
    })
  );

  // 5. Render all segments synchronously
  const segmentDataList = segments.map(segment =>
    segment.render(sessionData, db)
  );

  // 6. Apply powerline styling
  const statusline = renderPowerline(segmentDataList, config.theme);

  // 7. Output to stdout
  console.log(statusline);
}
```

### 2. Segment System

**Base Interface (src/segments/base.ts):**

```typescript
export interface SegmentData {
  text: string;
  colors: {
    fg: string;
    bg: string;
  };
}

export abstract class Segment {
  constructor(protected config: SegmentConfig) {}

  abstract render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData;

  // Optional async cache update
  async updateCache?(): Promise<void>;
}
```

**Usage Segment (src/segments/usage.ts):**

Combines Claude Code and Codex CLI usage:

```typescript
export class UsageSegment extends Segment {
  async updateCache(): Promise<void> {
    const timezone = getSystemTimezone();

    // Fetch both sources in parallel
    const [claudeData, codexData] = await Promise.all([
      this.loadTodayData(),      // ccusage library
      loadCodexTodayData(timezone), // bunx @ccusage/codex
    ]);

    // Combine costs
    this.cachedData = {
      date: getTodayDate(),
      cost: claudeData.cost + codexData.cost,
      tokens: claudeData.inputTokens + claudeData.outputTokens +
              codexData.inputTokens + codexData.outputTokens,
    };
  }
}
```

**Pace Segment (src/segments/pace.ts):**

Uses EWMA for smoothed burn rate:

```typescript
export class PaceSegment extends Segment {
  async updateCache(): Promise<void> {
    const hourlyUsage = await calculatePace({
      halfLifeMinutes: this.config.display.halfLifeMinutes,
    });
    this.cachedPace = hourlyUsage.pace;
  }
}
```

### 3. EWMA Pace Calculation (src/usage/hourly-calculator.ts)

The pace calculator reads JSONL transcript files and applies exponential decay weighting:

```typescript
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

  // Normalize by effective window (halfLife / ln(2))
  const effectiveWindowMs = halfLifeMs / Math.LN2;
  const effectiveWindowHours = effectiveWindowMs / (1000 * 60 * 60);

  return weightedCostSum / effectiveWindowHours;
}
```

**Key features:**
- Reads JSONL files from `~/.claude/projects/*/`
- Filters entries within lookback window (6 × half-life)
- Applies exponential decay weighting
- Returns $/hr pace

### 4. Powerline Renderer (src/renderer/powerline.ts)

Supports two color modes:

```typescript
export function renderPowerline(
  segments: SegmentData[],
  theme: ThemeConfig
): string {
  const isTextMode = theme.colorMode === 'text';
  const parts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (isTextMode) {
      // Text mode: colored text only
      styledText = chalk.hex(segment.colors.fg)(segment.text);
      separator = chalk.dim('|');
    } else {
      // Background mode: colored backgrounds with powerline separators
      styledText = chalk
        .hex(segment.colors.fg)
        .bgHex(segment.colors.bg)(` ${segment.text} `);
      separator = chalk
        .hex(darkenColor(segment.colors.bg))
        .bgHex(nextSegment.colors.bg)(SEPARATORS[style].right);
    }

    parts.push(styledText);
    if (nextSegment) parts.push(separator);
  }

  // Join with spaces for word-wrap friendliness
  return parts.join(' ');
}
```

### 5. Configuration System (src/config/)

**Type Definitions (src/config/types.ts):**

```typescript
export type SeparatorStyle = 'angled' | 'thin' | 'rounded' | 'flame' | 'slant' | 'backslant';
export type ColorMode = 'background' | 'text';
export type PathDisplayMode = 'name' | 'full' | 'project' | 'parent';

export interface ThemeConfig {
  powerline: boolean;
  separatorStyle: SeparatorStyle;
  colorMode: ColorMode;
}

export type SegmentConfig =
  | UsageSegmentConfig
  | PaceSegmentConfig
  | DirectorySegmentConfig
  | GitSegmentConfig
  | PrSegmentConfig
  | TimeSegmentConfig
  | ThoughtsSegmentConfig;
```

## Data Flow

### Input from Claude Code

Claude Code sends JSON via stdin:

```json
{
  "cwd": "/Users/josh/repos/cc-hud",
  "git": {
    "branch": "main",
    "isDirty": true,
    "ahead": 0,
    "behind": 0
  },
  "session": {
    "id": "session-123",
    "model": "claude-opus-4-5"
  }
}
```

### Usage Data Sources

**Claude Code (ccusage library):**
- Reads JSONL transcripts from `~/.claude/projects/`
- Uses `loadDailyUsageData()` with current timezone
- Fetches latest pricing with `offline: false`

**Codex CLI:**
- Runs `bunx @ccusage/codex@latest daily --json --since <today>`
- Parses JSON output for today's totals
- Gracefully fails if CLI unavailable

### Pace Calculation

1. Scan JSONL files modified within lookback window
2. Parse entries with `message.usage` data
3. Calculate cost per entry using model pricing table
4. Apply EWMA weighting based on timestamp age
5. Normalize by effective window for $/hr rate

### Output

Single line of ANSI-colored text with word-wrap-friendly spacing:

```
› repos/cc-hud | ⎇ main ✗ | ↑↰ #123 | Σ $240.76 today | △ $28.35/hr | ◔ 10:16pm | ◇ Quote here
```

## Performance Considerations

### Target: <100ms total execution

**Breakdown:**
- Bun startup: ~3-5ms
- Read stdin: ~1ms
- Load config: ~1ms (file read)
- ccusage fetch: ~50-100ms (parallel with Codex)
- Codex CLI: ~50-100ms (parallel with ccusage)
- Pace calculation: ~5-10ms (file I/O)
- Render segments: ~1ms
- Output: <1ms

**Optimizations:**
- Parallel async fetches (ccusage + Codex)
- Direct JSONL file reading for pace (no external process)
- Minimal dependencies (chalk only)
- Space-joined output (simple string concatenation)

### Memory Usage

Target: <30MB

- Bun runtime: ~10MB base
- ccusage data: ~5MB
- JSONL parsing: ~5MB (streaming)
- chalk: ~1MB

## Error Handling

### Graceful Degradation

If any component fails, cc-hud:
1. Logs error to stderr (not stdout)
2. Falls back to default or skips segment
3. Never crashes Claude Code

**Examples:**

```typescript
// Codex CLI unavailable
async function loadCodexTodayData() {
  try {
    const result = execSync('bunx @ccusage/codex...');
    return JSON.parse(result);
  } catch {
    // Silently return zero - Codex is optional
    return { cost: 0, inputTokens: 0, outputTokens: 0 };
  }
}

// Config validation
try {
  validateConfig(userConfig);
} catch (error) {
  console.error('[cc-hud] Invalid config:', error.message);
  return getDefaultConfig();
}
```

## Testing Strategy

### Manual Testing
- Test with Claude Code in real environment
- Verify all separator styles render correctly
- Check text mode vs background mode
- Test word-wrapping behavior
- Verify EWMA decay over time

### Performance Testing
- Measure startup time with `time bunx cc-hud`
- Profile slow segments individually
- Monitor memory with `--inspect`

## Summary

cc-hud uses a modular architecture:
- **Segment system** for extensibility (7 segment types)
- **Bun + TypeScript** for speed and maintainability
- **ccusage + Codex CLI** for comprehensive usage tracking
- **EWMA algorithm** for intelligent pace calculation
- **Dual color modes** (background powerline or text-only)
- **Word-wrap friendly** output with space-joined parts

The design prioritizes:
1. **Accuracy** (combined usage sources, EWMA smoothing)
2. **Performance** (<100ms execution time)
3. **Reliability** (graceful error handling)
4. **Extensibility** (easy to add segments)
5. **User experience** (simple configuration, sensible defaults)
