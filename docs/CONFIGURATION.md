# Statusline Configuration

Complete configuration reference for cc-hud statusline.

Config file location: `~/.claude/cc-hud.json`

## Minimal Configuration

cc-hud works with sensible defaults. A minimal config:

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
      "colors": { "fg": "#ff6666", "bg": "#ec4899" }
    },
    {
      "type": "git",
      "display": { "icon": true, "branch": true, "status": true },
      "colors": { "fg": "#ffbd55", "bg": "#f97316" }
    },
    {
      "type": "pr",
      "display": { "icon": true, "number": true },
      "colors": { "fg": "#ffff66", "bg": "#10b981" }
    },
    {
      "type": "usage",
      "display": { "icon": true, "cost": true, "tokens": false, "period": "today" },
      "colors": { "fg": "#9de24f", "bg": "#3b82f6" }
    },
    {
      "type": "pace",
      "display": { "icon": true, "period": "hourly", "halfLifeMinutes": 7 },
      "colors": { "fg": "#87cefa", "bg": "#9333ea" }
    },
    {
      "type": "time",
      "display": { "icon": true, "format": "12h", "seconds": false },
      "colors": { "fg": "#c084fc", "bg": "#9333ea" }
    },
    {
      "type": "thoughts",
      "display": { "icon": true, "quotes": false },
      "colors": { "fg": "#9ca3af", "bg": "#6b7280" },
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

Valid segment types for overrides: `directory`, `git`, `pr`, `usage`, `pace`, `time`, `thoughts`

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
- `"name"` - Directory name only: `cc-hud`
- `"full"` - Full path with ~: `~/repos/cc-hud`
- `"project"` - From git root: `cc-hud/src`
- `"parent"` - Parent + name: `repos/cc-hud`

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
