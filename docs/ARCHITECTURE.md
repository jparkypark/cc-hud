# Architecture

This document describes the technical implementation of cc-hud.

## Overview

cc-hud is a command-line tool that:
1. Receives JSON input from Claude Code via stdin
2. Reads configuration from `~/.claude/cc-hud.json`
3. Queries Claude's SQLite database for usage data
4. Renders segments with powerline styling
5. Outputs a single line of ANSI-colored text to stdout

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│ Claude Code                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Sends JSON via stdin                            │ │
│ │ {                                               │ │
│ │   "cwd": "/path/to/project",                    │ │
│ │   "git": { ... },                               │ │
│ │   "session": { ... }                            │ │
│ │ }                                               │ │
│ └─────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│ cc-hud (src/index.ts)                               │
│                                                     │
│ ┌─────────────────┐  ┌─────────────────┐          │
│ │ Config Parser   │  │ Database Client │          │
│ │ (config/)       │  │ (database/)     │          │
│ │                 │  │                 │          │
│ │ ~/.claude/      │  │ ~/.claude/      │          │
│ │ cc-hud.json     │  │ statusline-     │          │
│ │                 │  │ usage.db        │          │
│ └─────────────────┘  └─────────────────┘          │
│          │                    │                     │
│          └────────┬───────────┘                     │
│                   ▼                                 │
│         ┌──────────────────┐                        │
│         │ Segment System   │                        │
│         │ (segments/)      │                        │
│         │                  │                        │
│         │ - UsageSegment   │                        │
│         │ - DirSegment     │                        │
│         │ - GitSegment     │                        │
│         └──────────────────┘                        │
│                   │                                 │
│                   ▼                                 │
│         ┌──────────────────┐                        │
│         │ Powerline        │                        │
│         │ Renderer         │                        │
│         │ (renderer/)      │                        │
│         └──────────────────┘                        │
│                   │                                 │
└───────────────────┼─────────────────────────────────┘
                    ▼
        ANSI-colored string to stdout
        " $1.23 today  ~/repos/cc-hud  main "
```

## Project Structure

```
cc-hud/
├── src/
│   ├── index.ts              # Main entry point
│   ├── segments/
│   │   ├── base.ts           # Segment interface
│   │   ├── usage.ts          # Usage segment implementation
│   │   ├── directory.ts      # Directory segment implementation
│   │   ├── git.ts            # Git segment implementation
│   │   └── index.ts          # Segment registry
│   ├── database/
│   │   ├── client.ts         # SQLite connection wrapper
│   │   └── queries.ts        # Database query functions
│   ├── config/
│   │   ├── parser.ts         # Config file parser
│   │   ├── validator.ts      # Config validation
│   │   └── defaults.ts       # Default configuration
│   └── renderer/
│       ├── powerline.ts      # Powerline rendering logic
│       └── colors.ts         # Color utilities
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

// 1. Read stdin from Claude Code
const input = await readStdin();
const sessionData = JSON.parse(input);

// 2. Load and validate config
const config = await loadConfig('~/.claude/cc-hud.json');

// 3. Initialize database connection
const db = new DatabaseClient('~/.claude/statusline-usage.db');

// 4. Render each segment
const segments = config.segments.map(segmentConfig => {
  const Segment = getSegmentClass(segmentConfig.type);
  const segment = new Segment(segmentConfig);
  return segment.render(sessionData, db);
});

// 5. Apply powerline styling
const statusline = renderPowerline(segments, config.theme);

// 6. Output to stdout
console.log(statusline);
```

### 2. Segment System

**Base Interface (src/segments/base.ts):**

```typescript
export interface SegmentConfig {
  type: string;
  display: Record<string, any>;
  colors: {
    fg: string;
    bg: string;
  };
}

export interface SegmentData {
  text: string;
  colors: {
    fg: string;
    bg: string;
  };
}

export abstract class Segment {
  constructor(protected config: SegmentConfig) {}

  abstract render(
    sessionData: any,
    db: DatabaseClient
  ): SegmentData;

  abstract getDefaultConfig(): Partial<SegmentConfig>;
}
```

**Usage Segment (src/segments/usage.ts):**

```typescript
export class UsageSegment extends Segment {
  render(sessionData: any, db: DatabaseClient): SegmentData {
    const { display } = this.config;
    const today = new Date().toISOString().split('T')[0];

    // Query database for today's totals
    const data = db.getDailySummary(today);

    // Build text based on display flags
    const parts: string[] = [];

    if (display.cost) {
      parts.push(`$${data.total_cost.toFixed(2)}`);
    }

    if (display.tokens) {
      const totalTokens =
        data.total_input_tokens +
        data.total_output_tokens;
      parts.push(`${formatTokens(totalTokens)}`);
    }

    if (display.period) {
      parts.push(display.period);
    }

    return {
      text: parts.join(' '),
      colors: this.config.colors
    };
  }

  getDefaultConfig(): Partial<SegmentConfig> {
    return {
      display: {
        cost: true,
        tokens: false,
        period: 'today'
      },
      colors: {
        fg: '#88c0d0',
        bg: '#2e3440'
      }
    };
  }
}
```

**Directory Segment (src/segments/directory.ts):**

```typescript
export class DirectorySegment extends Segment {
  render(sessionData: any, db: DatabaseClient): SegmentData {
    const { display } = this.config;
    const cwd = sessionData.cwd || process.cwd();

    let text = '';

    if (display.icon) {
      text += ' ';  // Folder icon
    }

    if (display.fullPath) {
      text += cwd;
    } else {
      // Just the directory name
      text += cwd.split('/').pop() || cwd;
    }

    return {
      text,
      colors: this.config.colors
    };
  }

  getDefaultConfig(): Partial<SegmentConfig> {
    return {
      display: {
        icon: true,
        fullPath: false
      },
      colors: {
        fg: '#d8dee9',
        bg: '#2e3440'
      }
    };
  }
}
```

**Git Segment (src/segments/git.ts):**

```typescript
export class GitSegment extends Segment {
  render(sessionData: any, db: DatabaseClient): SegmentData {
    const { display } = this.config;
    const git = sessionData.git;

    if (!git || !git.branch) {
      return { text: '', colors: this.config.colors };
    }

    const parts: string[] = [];

    if (display.branch) {
      parts.push(` ${git.branch}`);  //  = git branch icon
    }

    if (display.status && git.isDirty) {
      parts.push('✗');
    }

    if (display.ahead && git.ahead > 0) {
      parts.push(`↑${git.ahead}`);
    }

    if (display.behind && git.behind > 0) {
      parts.push(`↓${git.behind}`);
    }

    return {
      text: parts.join(' '),
      colors: this.config.colors
    };
  }

  getDefaultConfig(): Partial<SegmentConfig> {
    return {
      display: {
        branch: true,
        status: true,
        ahead: true,
        behind: true
      },
      colors: {
        fg: '#8fbcbb',
        bg: '#2e3440'
      }
    };
  }
}
```

### 3. Database Layer (src/database/)

**Client (src/database/client.ts):**

```typescript
import { Database } from 'bun:sqlite';

export class DatabaseClient {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true });
  }

  getDailySummary(date: string): DailySummary {
    const query = `
      SELECT
        total_sessions,
        total_input_tokens,
        total_output_tokens,
        total_cache_tokens,
        total_cost,
        models_used
      FROM daily_summaries
      WHERE date = ?
    `;

    const result = this.db.query(query).get(date);

    return result || {
      total_sessions: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_tokens: 0,
      total_cost: 0.0,
      models_used: '[]'
    };
  }

  close() {
    this.db.close();
  }
}
```

**Database Schema Reference:**

Claude maintains the database at `~/.claude/statusline-usage.db` with the following schema:

```sql
CREATE TABLE daily_summaries (
    date TEXT PRIMARY KEY,              -- 'YYYY-MM-DD'
    total_sessions INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cache_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    models_used TEXT DEFAULT '[]',      -- JSON array
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Configuration System (src/config/)

**Parser (src/config/parser.ts):**

```typescript
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export async function loadConfig(): Promise<Config> {
  const configPath = join(homedir(), '.claude', 'cc-hud.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content);

    // Validate config
    validateConfig(userConfig);

    // Merge with defaults
    return mergeWithDefaults(userConfig);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Config doesn't exist, use defaults
      return getDefaultConfig();
    }
    throw error;
  }
}
```

**Validator (src/config/validator.ts):**

```typescript
export function validateConfig(config: any): void {
  if (!config.segments || !Array.isArray(config.segments)) {
    throw new Error('Config must have segments array');
  }

  for (const segment of config.segments) {
    if (!segment.type) {
      throw new Error('Each segment must have a type');
    }

    if (!segment.display) {
      throw new Error('Each segment must have display config');
    }

    if (!segment.colors || !segment.colors.fg || !segment.colors.bg) {
      throw new Error('Each segment must have fg and bg colors');
    }

    // Validate hex colors
    if (!isValidHex(segment.colors.fg) || !isValidHex(segment.colors.bg)) {
      throw new Error('Colors must be valid hex codes (#rrggbb)');
    }
  }

  if (config.theme) {
    const validStyles = ['angled', 'thin', 'rounded', 'flame'];
    if (!validStyles.includes(config.theme.separatorStyle)) {
      throw new Error(`Invalid separator style. Must be one of: ${validStyles.join(', ')}`);
    }
  }
}
```

### 5. Powerline Renderer (src/renderer/)

**Separator Definitions:**

```typescript
export const SEPARATORS = {
  angled: {
    right: '\uE0B0',  //
    left: '\uE0B2'    //
  },
  thin: {
    right: '\uE0B1',  //
    left: '\uE0B3'    //
  },
  rounded: {
    right: '\uE0B4',  //
    left: '\uE0B6'    //
  },
  flame: {
    right: '\uE0C0',  //
    left: '\uE0C2'    //
  }
};
```

**Renderer (src/renderer/powerline.ts):**

```typescript
import chalk from 'chalk';

export function renderPowerline(
  segments: SegmentData[],
  theme: ThemeConfig
): string {
  const separator = SEPARATORS[theme.separatorStyle || 'angled'].right;
  const parts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    // Skip empty segments
    if (!segment.text) continue;

    // Render segment text with colors
    const styledText = chalk
      .hex(segment.colors.fg)
      .bgHex(segment.colors.bg)(` ${segment.text} `);

    parts.push(styledText);

    // Add separator between segments
    if (nextSegment) {
      // Separator color = current segment bg on next segment bg
      const styledSeparator = chalk
        .hex(segment.colors.bg)
        .bgHex(nextSegment.colors.bg)(separator);

      parts.push(styledSeparator);
    } else {
      // Final separator (segment bg on terminal default)
      const styledSeparator = chalk.hex(segment.colors.bg)(separator);
      parts.push(styledSeparator);
    }
  }

  return parts.join('');
}
```

**Key Insight:** The separator between two segments is painted with:
- **Foreground color:** Current segment's background
- **Background color:** Next segment's background (or terminal default for last segment)

This creates the seamless "flowing" powerline effect.

## Data Flow

### Input from Claude Code

Claude Code sends JSON via stdin:

```json
{
  "cwd": "/Users/josh/repos/cc-hud",
  "git": {
    "branch": "main",
    "isDirty": false,
    "ahead": 0,
    "behind": 0
  },
  "session": {
    "id": "session-123",
    "model": "claude-sonnet-4"
  }
}
```

### Configuration Example

User's `~/.claude/cc-hud.json`:

```json
{
  "segments": [
    {
      "type": "usage",
      "display": {
        "cost": true,
        "tokens": false,
        "period": "today"
      },
      "colors": {
        "fg": "#88c0d0",
        "bg": "#2e3440"
      }
    },
    {
      "type": "directory",
      "display": {
        "icon": true,
        "fullPath": false
      },
      "colors": {
        "fg": "#d8dee9",
        "bg": "#2e3440"
      }
    },
    {
      "type": "git",
      "display": {
        "branch": true,
        "status": true,
        "ahead": true,
        "behind": true
      },
      "colors": {
        "fg": "#8fbcbb",
        "bg": "#2e3440"
      }
    }
  ],
  "theme": {
    "powerline": true,
    "separatorStyle": "angled"
  }
}
```

### Output to stdout

Single line of ANSI-colored text:

```
 $1.23 today  cc-hud  main
```

(With appropriate colors and powerline separators, which don't render in plain text)

## Performance Considerations

### Startup Time

Target: <10ms total execution time

**Breakdown:**
- Bun startup: ~3-5ms
- Read stdin: ~1ms
- Load config: ~1ms (cached after first run)
- SQLite query: ~1-2ms (single row lookup)
- Render segments: ~1ms
- Output: <1ms

**Optimizations:**
- Use Bun's native SQLite (faster than better-sqlite3)
- Read-only database connection
- Config caching (future)
- Minimal dependencies (only chalk)

### Memory Usage

Target: <20MB

- Bun runtime: ~10MB base
- SQLite connection: ~1-2MB
- Config + segments: <1MB
- chalk: ~1MB

## Error Handling

### Graceful Degradation

If any component fails, cc-hud should:
1. Log error to stderr (not stdout, to avoid breaking statusline)
2. Fall back to minimal display or skip failed segment
3. Never crash Claude Code

**Example:**

```typescript
try {
  const usageData = db.getDailySummary(today);
  // render usage segment
} catch (error) {
  console.error('[cc-hud] Failed to load usage data:', error);
  // Skip usage segment, continue with other segments
}
```

### Config Validation

Invalid config should:
1. Show clear error message
2. Suggest fix
3. Fall back to defaults if possible

**Example:**

```typescript
try {
  validateConfig(userConfig);
} catch (error) {
  console.error('[cc-hud] Invalid config:', error.message);
  console.error('[cc-hud] Falling back to default configuration');
  return getDefaultConfig();
}
```

## Testing Strategy

### Unit Tests

- Segment rendering logic
- Config parsing and validation
- Color utilities
- Powerline separator logic

### Integration Tests

- End-to-end: JSON input → rendered output
- Database queries with test database
- Config loading from file

### Manual Testing

- Test with Claude Code in real environment
- Verify all separator styles render correctly
- Check various terminal emulators (iTerm2, Alacritty, Warp, etc.)
- Test with different Nerd Fonts

## Future Enhancements

### Phase 2 Features

1. **Multiple time periods** for usage segment
2. **Format strings** for custom templates
3. **Plugin system** for custom segments
4. **Theme presets** (nord, dracula, gruvbox, etc.)
5. **Config validation command** (`bunx cc-hud validate`)
6. **Live reload** on config changes
7. **Performance profiling** command for debugging

### Architectural Considerations

- Keep segment system extensible (easy to add new segments)
- Maintain config backwards compatibility
- Consider plugin API for third-party segments
- Document extension points for contributors

---

## Summary

cc-hud uses a clean, modular architecture:
- **Segment system** for extensibility
- **Bun + TypeScript** for speed and maintainability
- **Native SQLite** for fast database access
- **Powerline renderer** for beautiful output
- **Simple config format** for user customization

The design prioritizes:
1. **Performance** (<10ms execution time)
2. **Reliability** (graceful error handling)
3. **Extensibility** (easy to add segments)
4. **User experience** (simple configuration)
