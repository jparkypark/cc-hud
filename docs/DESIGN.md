# Design Decisions

This document captures the key design decisions made during development of chud.

## Overview

chud was created because existing Claude Code statusline packages lacked sufficient customization options. While they offered theme support, they didn't allow granular control over what information is displayed, segment ordering, or full color customization.

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
2. ✅ Calculate live daily totals from Claude transcripts
3. ✅ Granular display control (show/hide any piece of info per segment)
4. ✅ Full color customization
5. ✅ Powerline styling with multiple separator options
6. ✅ EWMA-based pace calculation for burn rate tracking
7. ✅ Combined Claude Code + Codex usage tracking

## Current Implementation

### Segments (7 types)

| Segment | Purpose | Key Features |
|---------|---------|--------------|
| `usage` | Daily cost tracking | Combines Claude Code + Codex CLI usage |
| `pace` | Hourly burn rate | EWMA smoothing with configurable half-life |
| `directory` | Current path | Multiple display modes (name, full, project, parent) |
| `git` | Repository status | Branch, dirty status, ahead/behind counts |
| `pr` | GitHub PR info | PR number for current branch via `gh` CLI |
| `time` | Current time | 12h/24h format, optional seconds |
| `thoughts` | Random quotes | Custom pool or zenquotes.io API |

### Theme System

**Color Modes:**
- `background` - Classic powerline with colored backgrounds
- `text` - Colored text only with pipe separators (cleaner look)

**Separator Styles:**
- `angled` - Classic powerline chevrons (default)
- `thin` - Subtle outlined separators
- `rounded` - Smooth rounded transitions
- `flame` - Decorative flame-style separators
- `slant` - Forward-slanting diagonal
- `backslant` - Backward-slanting diagonal

### Pace Calculation (EWMA)

The pace segment uses Exponential Weighted Moving Average for accurate burn rate:

- Recent costs weighted more heavily than older costs
- Configurable half-life (default: 7 minutes, ~10 min effective window)
- Pace naturally decays when idle
- Based on industry-standard algorithms (same approach as CPU load averages)

**Formula:**
```
weight = 2^(-age / halfLife)
pace = Σ(cost × weight) / effectiveWindow
```

Where `effectiveWindow = halfLife / ln(2) ≈ 1.44 × halfLife`

---

## Finalized Design Decisions

### 1. Configuration File Location

**Decision:** `~/.claude/chud.json`

**Rationale:**
- Follows the pattern of other Claude Code statusline packages
- Claude-specific tool, makes sense to keep configs together
- Users already know where `~/.claude/` is
- Simpler than creating a separate `~/.chud/` directory

---

### 2. Default Segments

**Decision:** Seven segments in order: directory, git, pr, usage, pace, time, thoughts

**Rationale:**
- Context first (where am I, what branch, what PR)
- Then metrics (cost, pace)
- Then ambient info (time, thoughts)

---

### 3. Usage Data Sources

**Decision:** Combine ccusage library + Codex CLI

**Implementation:**
- Claude Code usage via `ccusage` library (loadDailyUsageData)
- Codex CLI usage via `bunx @ccusage/codex@latest daily --json`
- Both fetched in parallel for performance
- Graceful degradation if Codex CLI unavailable

**Rationale:**
- ccusage is authoritative for Claude Code transcripts
- Codex CLI provides OpenAI Codex usage data
- Combined total shows true AI spend across tools

---

### 4. Pace Calculation Algorithm

**Decision:** EWMA with configurable half-life

**Why EWMA over simple averaging:**
- Simple `cost / time` gives misleading results (old bursts never fade)
- Rolling window has arbitrary cutoff (sudden drops)
- EWMA smoothly decays old data while weighting recent activity

**Default half-life:** 7 minutes (~10 minute effective window)
- Responsive enough to reflect current activity
- Stable enough to smooth brief pauses

---

### 5. Display Control: Boolean Toggles

**Decision:** Boolean toggles for each display option

**Example:**
```json
{
  "type": "usage",
  "display": {
    "icon": true,
    "cost": true,
    "tokens": false,
    "period": "today"
  }
}
```

**Rationale:**
- Simple to understand and configure
- Covers most use cases
- Easy to validate
- Format strings considered but deferred (added complexity)

---

### 6. Separator Rendering

**Decision:** Separate units with space-joined output for word-wrap friendliness

**Implementation:**
- Each segment and separator is its own "word"
- `parts.join(' ')` creates natural word-break points
- Terminal can wrap at segment boundaries, not mid-segment

**Rationale:**
- Prevents awkward wrapping in narrow terminals
- Each segment stays intact when wrapping occurs

---

### 7. Technology Stack

**Decision:** TypeScript with Bun

**Stack:**
- Language: TypeScript (native support, no build step)
- Runtime: Bun 1.0+
- Usage data: ccusage library + Codex CLI
- ANSI colors: chalk
- Config format: JSON

**Rationale:**
- **Performance matters for statuslines** - Runs on every prompt
  - Bun startup: 3-5ms vs Node's 50-100ms
- **No build step needed** - Bun runs TypeScript directly
- **Users already have Bun** - Claude Code uses Bun
- **ccusage library** - Proven solution for Claude transcript parsing

---

## Configuration Schema

### Full Example

```json
{
  "segments": [
    {
      "type": "directory",
      "display": {
        "icon": true,
        "pathMode": "parent",
        "rootWarning": false
      },
      "colors": { "fg": "#ff6666", "bg": "#ec4899" }
    },
    {
      "type": "git",
      "display": {
        "icon": true,
        "branch": true,
        "status": true,
        "ahead": true,
        "behind": true
      },
      "colors": { "fg": "#ffbd55", "bg": "#f97316" }
    },
    {
      "type": "pr",
      "display": {
        "icon": true,
        "number": true
      },
      "colors": { "fg": "#ffff66", "bg": "#10b981" }
    },
    {
      "type": "usage",
      "display": {
        "icon": true,
        "cost": true,
        "tokens": false,
        "period": "today"
      },
      "colors": { "fg": "#9de24f", "bg": "#3b82f6" }
    },
    {
      "type": "pace",
      "display": {
        "icon": true,
        "period": "hourly",
        "halfLifeMinutes": 7
      },
      "colors": { "fg": "#87cefa", "bg": "#9333ea" }
    },
    {
      "type": "time",
      "display": {
        "icon": true,
        "format": "12h",
        "seconds": false
      },
      "colors": { "fg": "#c084fc", "bg": "#9333ea" }
    },
    {
      "type": "thoughts",
      "display": {
        "icon": true,
        "quotes": false
      },
      "colors": { "fg": "#9ca3af", "bg": "#6b7280" },
      "useApiQuotes": true
    }
  ],
  "theme": {
    "powerline": true,
    "separatorStyle": "angled",
    "colorMode": "text"
  }
}
```

---

## Future Enhancements

### Potential Features
1. Multiple time periods for usage segment (7d, 30d, month)
2. Format strings for custom templates
3. Custom segment plugins
4. Theme presets (nord, dracula, gruvbox, etc.)
5. Codex CLI integration for pace calculation (currently ~4% of cost, low priority)
6. Token usage breakdown by model
7. Rate limit indicators

### Philosophy
Ship focused features that solve real problems, then iterate based on usage. EWMA pace calculation is an example of solving a real pain point (misleading simple averages) with a proven algorithm.

---

## Summary

chud provides:
1. ✅ Maximum flexibility (segment ordering, granular display control)
2. ✅ Accurate cost tracking (ccusage + Codex CLI)
3. ✅ Intelligent pace calculation (EWMA smoothing)
4. ✅ Full color customization (background or text-only modes)
5. ✅ Multiple powerline styles (6 separator options)
6. ✅ Word-wrap friendly output
7. ✅ Room to grow (modular architecture)
