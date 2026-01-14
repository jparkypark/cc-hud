# Statusline Configuration

Complete configuration reference for chud statusline.

## Setup

To configure Claude Code to use the statusline:

```bash
mise run install statusline   # Install dependencies
mise run configure            # Configure Claude Code automatically
```

The `configure` command updates `~/.claude/settings.json` with the statusLine settings. Restart Claude Code after running it.

**Manual setup:** If you prefer, add this to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun /path/to/chud/apps/statusline/src/index.ts"
  }
}
```

## Statusline Config

Config file location: `~/.claude/chud.json`

## Minimal Configuration

chud works with sensible defaults. A minimal config:

```json
{
  "theme": {
    "colorMode": "text"
  }
}
```

## Full Configuration Example

```json
{
  "segments": [
    {
      "type": "directory",
      "display": { "icon": true, "pathMode": "parent" },
      "colors": { "fg": "#ffffff", "bg": "#ef4444" }
    },
    {
      "type": "git",
      "display": { "icon": true, "branch": true, "status": true },
      "colors": { "fg": "#ffffff", "bg": "#f97316" }
    },
    {
      "type": "pr",
      "display": { "icon": true, "number": true },
      "colors": { "fg": "#ffffff", "bg": "#eab308" }
    },
    {
      "type": "usage",
      "display": { "icon": true, "cost": true, "tokens": false, "period": "today" },
      "colors": { "fg": "#ffffff", "bg": "#22c55e" }
    },
    {
      "type": "pace",
      "display": { "icon": true, "period": "hourly", "halfLifeMinutes": 7 },
      "colors": { "fg": "#ffffff", "bg": "#06b6d4" }
    },
    {
      "type": "context",
      "display": { "icon": true, "mode": "remaining" },
      "colors": { "fg": "#ffffff", "bg": "#3b82f6" }
    },
    {
      "type": "time",
      "display": { "icon": true, "format": "12h", "seconds": false },
      "colors": { "fg": "#ffffff", "bg": "#6366f1" }
    },
    {
      "type": "thoughts",
      "display": { "icon": true, "quotes": false },
      "colors": { "fg": "#ffffff", "bg": "#8b5cf6" },
      "useApiQuotes": true
    }
  ],
  "theme": {
    "powerline": true,
    "separatorStyle": "angled",
    "colorMode": "text",
    "themeMode": "auto"
  },
  "darkTheme": {
    "usage": { "fg": "#00ff00" }
  },
  "lightTheme": {
    "usage": { "fg": "#006600" }
  }
}
```

## Theme Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `powerline` | `true`, `false` | `true` | Enable powerline separators |
| `separatorStyle` | See below | `"angled"` | Separator character style |
| `colorMode` | `"background"`, `"text"` | `"text"` | How colors are applied |
| `themeMode` | `"auto"`, `"light"`, `"dark"` | `"auto"` | Light/dark theme selection |

### Separator Styles

- `angled` - Classic powerline chevrons (default)
- `thin` - Subtle outlined separators
- `rounded` - Smooth rounded transitions
- `flame` - Decorative flame-style separators
- `slant` - Forward-slanting diagonal
- `backslant` - Backward-slanting diagonal

### Color Modes

- **`"text"`** - Colored text only, pipe separators between segments. Cleaner look, works with any terminal.
- **`"background"`** - Colored backgrounds with powerline separators. Requires a Nerd Font for proper rendering.

### Theme Modes

- **`"auto"`** - Detects system theme (macOS: reads AppleInterfaceStyle, Linux: uses COLORFGBG)
- **`"light"`** - Always use light theme colors
- **`"dark"`** - Always use dark theme colors

## Custom Theme Colors

Override default colors for light or dark themes:

```json
{
  "darkTheme": {
    "usage": { "fg": "#00ff00" },
    "git": { "fg": "#ff6600", "bg": "#333333" }
  },
  "lightTheme": {
    "usage": { "fg": "#006600" }
  }
}
```

Valid segment types for overrides: `directory`, `git`, `pr`, `usage`, `pace`, `context`, `time`, `thoughts`

**Color priority:**
1. Segment-level `colors` (highest)
2. Theme overrides (`darkTheme`/`lightTheme`)
3. Built-in theme defaults (lowest)

---

## Segments

### Directory

Current working directory with flexible path display.

```json
{
  "type": "directory",
  "display": {
    "icon": true,
    "pathMode": "parent",
    "rootWarning": true
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show > symbol |
| `pathMode` | string | `"parent"` | Path display mode (see below) |
| `rootWarning` | boolean | `false` | Show warning when not in git root |

**Path modes:**
- `"name"` - Directory name only: `chud`
- `"full"` - Full path with ~: `~/repos/chud`
- `"project"` - From git root: `chud/src`
- `"parent"` - Parent + name: `repos/chud`

---

### Git

Git repository status.

```json
{
  "type": "git",
  "display": {
    "icon": true,
    "branch": true,
    "status": true,
    "ahead": true,
    "behind": true
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show branch symbol |
| `branch` | boolean | `true` | Show branch name |
| `status` | boolean | `true` | Show clean/dirty indicator |
| `ahead` | boolean | `false` | Show commits ahead of remote |
| `behind` | boolean | `false` | Show commits behind remote |

---

### PR

GitHub pull request for current branch. Requires `gh` CLI.

```json
{
  "type": "pr",
  "display": {
    "icon": true,
    "number": true
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show PR symbol |
| `number` | boolean | `true` | Show PR number |

---

### Usage

Daily cost tracking combining Claude Code and Codex CLI usage.

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show sum symbol |
| `cost` | boolean | `true` | Show cost in dollars |
| `tokens` | boolean | `false` | Show token count (K/M suffix) |
| `period` | string | `"today"` | Label text |

---

### Pace

EWMA-smoothed hourly burn rate. Weights recent usage more heavily and decays naturally when idle.

```json
{
  "type": "pace",
  "display": {
    "icon": true,
    "period": "hourly",
    "halfLifeMinutes": 7
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show delta symbol |
| `period` | string | `"hourly"` | Label text |
| `halfLifeMinutes` | number | `7` | EWMA half-life in minutes |

**How half-life works:**

The half-life determines how quickly old costs "decay" in the pace calculation:

| Time ago | Weight (7 min half-life) |
|----------|-------------------------|
| Now | 100% |
| 7 min | 50% |
| 14 min | 25% |
| 21 min | 12.5% |

Lower values = more responsive to recent changes. Higher values = smoother, less spiky.

---

### Context

Context window usage percentage. Shows how much of Claude's context window has been used or remains.

```json
{
  "type": "context",
  "display": {
    "icon": true,
    "mode": "remaining"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show window symbol (◧) |
| `mode` | string | `"used"` | Display mode (see below) |

**Display modes:**
- `"used"` - Show percentage of context used: `◧ 46%`
- `"remaining"` - Show percentage remaining: `◧ 54%`
- `"both"` - Show both values: `◧ 46%/54%`

**Note:** This segment requires Claude Code to provide context window data. It will automatically hide when no data is available.

---

### Time

Current time display.

```json
{
  "type": "time",
  "display": {
    "icon": true,
    "format": "12h",
    "seconds": false
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show clock symbol |
| `format` | string | `"12h"` | `"12h"` or `"24h"` |
| `seconds` | boolean | `false` | Include seconds |

---

### Thoughts

Random thoughts or inspirational quotes.

```json
{
  "type": "thoughts",
  "display": {
    "icon": true,
    "quotes": false
  },
  "customThoughts": [
    "Ship it!",
    "One more test...",
    "Coffee time?"
  ],
  "useApiQuotes": false
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `icon` | boolean | `true` | Show star symbol |
| `quotes` | boolean | `false` | Wrap text in quote marks |
| `customThoughts` | string[] | `[]` | Your own thought strings |
| `useApiQuotes` | boolean | `false` | Fetch from zenquotes.io |

**Priority:** Custom thoughts are used if provided, otherwise API quotes if enabled, otherwise built-in defaults.

---

## Segment Colors

Each segment can have custom colors:

```json
{
  "type": "usage",
  "display": { "icon": true, "cost": true },
  "colors": {
    "fg": "#00ff00",
    "bg": "#1a1a1a"
  }
}
```

Colors must be in `#RRGGBB` hex format.

- **`fg`** - Foreground (text) color
- **`bg`** - Background color (only visible in `"background"` color mode)

---

## Segment Order

Segments appear in the order listed in the `segments` array. To reorder, rearrange the array:

```json
{
  "segments": [
    { "type": "git", ... },
    { "type": "directory", ... },
    { "type": "usage", ... }
  ]
}
```

To hide a segment, simply omit it from the array.
