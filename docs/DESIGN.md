# Design Decisions

This document captures the key design decisions made during the planning phase of cc-hud.

## Overview

cc-hud was created because existing Claude Code statusline packages lacked sufficient customization options. While they offered theme support, they didn't allow granular control over what information is displayed, segment ordering, or full color customization.

## Key Problems Solved

### Existing Solutions

1. **@owloops/claude-powerline** - Can't control segment order
2. **@chongdashu/cc-statusline** - Doesn't calculate live daily totals
3. **claude-statusline-powerline** - Has features but not customizable enough:
   - Can't customize what info is displayed per segment (e.g., show only cost without tokens)
   - Semantic coloring is hardcoded (purple for stats, gray for directory, green for git)
   - Can only change color shades via themes, not actual color assignments

### Our Goals

1. ✅ Control segment order
2. ✅ Calculate live daily totals from Claude's database
3. ✅ Granular display control (show/hide any piece of info per segment)
4. ✅ Full color customization
5. ✅ Powerline styling with multiple separator options

## Finalized Design Decisions

### 1. Configuration File Location

**Decision:** `~/.claude/cc-hud.json`

**Rationale:**
- Follows the pattern of other Claude Code statusline packages
- Claude-specific tool, makes sense to keep configs together
- Users already know where `~/.claude/` is
- Simpler than creating a separate `~/.cc-hud/` directory

**Alternative considered:** `~/.cc-hud/config.json` (dedicated directory)
- Would follow XDG/unix conventions
- Room for future expansion (themes/, plugins/)
- Rejected in favor of simplicity and consistency with existing tools

---

### 2. Default Segments

**Decision:** Three segments in order: usage, directory, git

**Configuration:**
```json
{
  "segments": [
    {
      "type": "usage",
      "display": {
        "cost": true,
        "tokens": false,
        "period": "today"
      }
    },
    {
      "type": "directory",
      "display": {
        "icon": true,
        "fullPath": false
      }
    },
    {
      "type": "git",
      "display": {
        "branch": true,
        "status": true,
        "ahead": true,
        "behind": true
      }
    }
  ]
}
```

**Rationale:**
- Most useful info at a glance
- Matches current user setup with claude-statusline-powerline
- Same order as claude-statusline-powerline (familiar to users)
- Usage is most important (cost tracking motivation for the project)

---

### 3. Time Periods for Usage Segment

**Decision:** Support "today" only in MVP

**Phase 1 (MVP):**
- `"today"` - Query `daily_summaries` table for current date

**Phase 2 (future):**
- `"7d"` - Sum last 7 days from daily_summaries
- `"30d"` - Sum last 30 days
- `"month"` - Current calendar month
- `"all"` - Total lifetime usage

**Rationale:**
- "today" solves the immediate need
- Keep MVP scope manageable
- Database already has the data structure (daily_summaries table)
- Easy to add more periods later without breaking changes

---

### 4. Display Control: Format Strings vs Boolean Toggles

**Decision:** Boolean toggles for MVP

**Phase 1 approach:**
```json
{
  "type": "usage",
  "display": {
    "cost": true,      // Show: "$1.23"
    "tokens": false,   // Hide token counts
    "period": "today"  // Label: "today"
  }
}
```
Output: `$1.23 today`

**Phase 2 approach (future):**
```json
{
  "type": "usage",
  "format": "${cost} over ${period}",
  "display": { "period": "today" }
}
```
Output: `$1.23 over today`

**Rationale:**
- Boolean toggles are simpler to implement and validate
- Covers 90% of use cases
- Format strings require parsing/templating engine (added complexity)
- Can add format strings later without breaking changes

---

### 5. Separator Styles

**Decision:** All styles available from day 1

**Supported styles:**
```typescript
const SEPARATORS = {
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

**Configuration:**
```json
{
  "theme": {
    "powerline": true,
    "separatorStyle": "angled"  // "angled" | "thin" | "rounded" | "flame"
  }
}
```

**Rationale:**
- All separators use standard Nerd Font powerline characters
- Implementation complexity is minimal (just character mapping)
- Provides visual variety for users who want it
- Angled is default (classic powerline look)

---

### 6. Technology Stack

**Decision:** TypeScript with Bun

**Stack:**
- Language: TypeScript (native support, no build step)
- Runtime: Bun 1.0+
- Database: bun:sqlite (native built-in SQLite)
- ANSI colors: chalk
- Config format: JSON

**Rationale:**
- **Performance matters for statuslines** - Runs on every prompt
  - Bun startup: 3-5ms vs Node's 50-100ms
  - Near-instant statusline rendering
- **No build step needed** - Bun runs TypeScript directly
  - Simpler development workflow
  - No tsc compilation, no dist/ folder
  - Direct `src/index.ts` execution
- **Users already have Bun** - Claude Code uses Bun
  - No extra installation burden
  - Aligned with Claude Code ecosystem
- **Native SQLite** - `bun:sqlite` is built-in
  - No native dependencies or compilation
  - Faster than better-sqlite3
  - No cross-platform issues
- **TypeScript is still the standard** - Type safety and IDE support
  - Matches other Claude Code statusline packages
  - Great autocomplete and refactoring

**Alternatives considered:**
- **Node.js** - More conservative but slower startup (50-100ms)
- **JavaScript** - Simpler but lacks type safety
- **Go/Rust** - Similar performance but slower development, fewer contributors

**Key advantage:** Bun combines the performance of Go/Rust with the developer experience of TypeScript/Node.

---

## Configuration Schema

### Full Example

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
    "separatorStyle": "angled",
    "separatorColor": "#2e3440"
  }
}
```

### Segment Types

#### Usage Segment
```json
{
  "type": "usage",
  "display": {
    "cost": boolean,      // Show/hide dollar amount
    "tokens": boolean,    // Show/hide token counts
    "period": "today"     // Currently only "today" supported
  },
  "colors": {
    "fg": "#hex",
    "bg": "#hex"
  }
}
```

#### Directory Segment
```json
{
  "type": "directory",
  "display": {
    "icon": boolean,      // Show/hide folder icon
    "fullPath": boolean   // Show full path or just directory name
  },
  "colors": {
    "fg": "#hex",
    "bg": "#hex"
  }
}
```

#### Git Segment
```json
{
  "type": "git",
  "display": {
    "branch": boolean,    // Show/hide branch name
    "status": boolean,    // Show/hide dirty indicator
    "ahead": boolean,     // Show/hide ahead count
    "behind": boolean     // Show/hide behind count
  },
  "colors": {
    "fg": "#hex",
    "bg": "#hex"
  }
}
```

---

## Future Enhancements

### Phase 2 Features (not in MVP)
1. Multiple time periods for usage segment (7d, 30d, month, all)
2. Format strings for custom templates
3. Additional separator styles beyond the 4 we're starting with
4. Custom segment plugins
5. Theme presets (nord, dracula, gruvbox, etc.)
6. Token usage breakdown by model
7. Rate limit indicators

### Philosophy
Ship a focused MVP that solves the core problem (customizable statusline with live daily totals), then iterate based on real usage.

---

## Research Findings

### Claude Code Statusline API

- **Input:** Receives JSON via stdin with session data
- **Output:** Single line of ANSI-colored text to stdout
- **Configuration:** Set in `~/.claude/settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "npx cc-hud"
  }
}
```

### Claude's Database Structure

**Location:** `~/.claude/statusline-usage.db`

**Key table:** `daily_summaries` (pre-calculated daily totals)
```sql
CREATE TABLE daily_summaries (
    date TEXT PRIMARY KEY,
    total_sessions INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cache_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    models_used TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key insight:** Claude maintains daily summaries automatically, so we don't need to aggregate from individual sessions for "today" totals. Just query the current date row.

### Powerline Technical Details

**Key insight:** Separator color must match the NEXT segment's background color to create the seamless "flowing" effect.

Example:
```
[Segment 1 with bg=#2e3440]<separator color=#3b4252>[Segment 2 with bg=#3b4252]
```

The separator's foreground color should be Segment 1's background, and it's painted on Segment 2's background.

---

## Summary

This design provides:
1. ✅ Maximum flexibility (segment ordering, granular display control)
2. ✅ Live daily cost tracking (the primary motivation)
3. ✅ Full color customization (not just themes)
4. ✅ Multiple powerline styles (visual variety)
5. ✅ Familiar patterns (follows existing statusline conventions)
6. ✅ Room to grow (architecture supports future enhancements)

The MVP scope is deliberately focused to ship something useful quickly while maintaining a clean architecture for future expansion.
