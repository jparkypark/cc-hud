# cc-hud

A toolkit for monitoring Claude Code sessions: a customizable statusline with live usage tracking, and a native macOS menu bar app to see all active sessions at a glance.

![cc-hud screenshot](docs/images/screenshot.png)

## Features

### Statusline
- **Granular display control** - Show/hide any piece of info per segment
- **Flexible segment ordering** - Arrange segments however you want
- **Live daily totals** - Accurate cost tracking (Claude Code + Codex CLI)
- **EWMA pace calculation** - Smoothed hourly burn rate with configurable half-life
- **Full color customization** - Foreground, background, or text-only color modes
- **Multiple powerline styles** - 6 separator styles with automatic color compensation
- **7 segment types** - Usage, pace, directory, git, PR, time, and thoughts

### Menu Bar App (macOS)
- **See all sessions** - Monitor 3-5+ concurrent Claude Code sessions
- **Status indicators** - Green (waiting for input), Yellow (working)
- **Session metadata** - Project name, path, git branch, time since last activity
- **Real-time updates** - Via Claude Code hooks

## Project Structure

```
cc-hud/
├── apps/
│   ├── statusline/           # TypeScript statusline
│   │   └── src/
│   └── menubar/              # Swift menu bar app
│       └── CCMenubar/
├── hooks/                    # Claude Code hooks for session tracking
│   ├── lib.sh
│   ├── session-start.sh
│   ├── session-update.sh
│   └── session-end.sh
└── docs/
```

## Statusline Installation

```bash
bun install -g cc-hud
```

Or use without installing:

```bash
bunx cc-hud
```

### Quick Start

1. Configure Claude Code to use cc-hud:

```json
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "bunx cc-hud"
  }
}
```

2. cc-hud works out of the box with sensible defaults. Optionally create `~/.claude/cc-hud.json` to customize.

3. Restart Claude Code to see your new statusline!

## Menu Bar App Installation

1. Open `apps/menubar/CCMenubar/CCMenubar.xcodeproj` in Xcode
2. Build and run (Cmd+R)
3. The app appears in your menu bar with a terminal icon

### Enabling Session Tracking

Add hooks to your Claude Code settings to track sessions:

```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/cc-hud/hooks/session-start.sh"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/cc-hud/hooks/session-update.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/cc-hud/hooks/session-end.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/cc-hud` with your actual installation path.

## Statusline Configuration

Config file: `~/.claude/cc-hud.json`

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
    "colorMode": "text"
  }
}
```

### Theme Options

- `powerline` - Enable powerline separators (default: true)
- `separatorStyle` - Separator style: `angled`, `thin`, `rounded`, `flame`, `slant`, `backslant`
- `colorMode` - Color mode:
  - `"background"` - Colored backgrounds with powerline separators
  - `"text"` - Colored text only, pipe separators (cleaner look)
- `themeMode` - Light/dark theme:
  - `"auto"` - Detect from system (default)
  - `"light"` - Light theme colors
  - `"dark"` - Dark theme colors

### Custom Theme Colors

Override colors for light or dark themes separately:

```json
{
  "theme": {
    "themeMode": "auto"
  },
  "darkTheme": {
    "usage": { "fg": "#00ff00" },
    "git": { "fg": "#ff6600", "bg": "#333333" }
  },
  "lightTheme": {
    "usage": { "fg": "#006600" }
  }
}
```

Theme colors are applied as defaults - any colors specified directly in segment config take precedence.

## Available Segments

### Directory
Current working directory with flexible path display.

| Option | Description |
|--------|-------------|
| `icon` | Show > symbol |
| `pathMode` | `"name"`, `"full"`, `"project"`, or `"parent"` |
| `rootWarning` | Show warning when not in git project root |

### Git
Git repository status.

| Option | Description |
|--------|-------------|
| `icon` | Show branch symbol |
| `branch` | Show current branch name |
| `status` | Show clean/dirty indicator |
| `ahead` | Show commits ahead |
| `behind` | Show commits behind |

### PR
GitHub pull request for current branch (uses `gh` CLI).

| Option | Description |
|--------|-------------|
| `icon` | Show PR symbol |
| `number` | Show PR number |

### Usage
Daily cost combining Claude Code and Codex CLI usage via [ccusage](https://github.com/jparkerweb/ccusage).

| Option | Description |
|--------|-------------|
| `icon` | Show sum symbol |
| `cost` | Show daily cost in dollars |
| `tokens` | Show total token count (K/M suffix) |
| `period` | Label to show (e.g., "today") |

### Pace
EWMA-smoothed hourly burn rate. Recent costs are weighted more heavily, and pace naturally decays when idle.

| Option | Description |
|--------|-------------|
| `icon` | Show delta symbol |
| `period` | Label (currently only "hourly") |
| `halfLifeMinutes` | EWMA half-life (default: 7, giving ~10 min effective window) |

**How half-life works:**
- Cost from 1 half-life ago: 50% weight
- Cost from 2 half-lives ago: 25% weight
- Cost from 3 half-lives ago: 12.5% weight

### Time
Current time display.

| Option | Description |
|--------|-------------|
| `icon` | Show clock symbol |
| `format` | `"12h"` or `"24h"` |
| `seconds` | Show seconds |

### Thoughts
Random thoughts or inspirational quotes.

| Option | Description |
|--------|-------------|
| `icon` | Show star symbol |
| `quotes` | Wrap text in quote marks |
| `customThoughts` | Array of custom thought strings |
| `useApiQuotes` | Fetch quotes from zenquotes.io API |

## Separator Styles

Six powerline separator styles with automatic 10% color darkening to compensate for font rendering:

- `angled` - Classic powerline chevrons (default)
- `thin` - Subtle outlined separators
- `rounded` - Smooth rounded transitions
- `flame` - Decorative flame-style separators
- `slant` - Forward-slanting diagonal
- `backslant` - Backward-slanting diagonal

## Documentation

- [Design Decisions](docs/DESIGN.md) - Why we made the choices we did
- [Architecture](docs/ARCHITECTURE.md) - Technical implementation details
- [Menu Bar App Design](docs/plans/2026-01-12-menubar-app-design.md) - Menu bar app design document

## Requirements

### Statusline
- Bun 1.0+ (already installed if you use Claude Code)
- Claude Code
- Terminal with Unicode support
- Any monospace font (icons use UTF-8 characters, not powerline glyphs)
- Optional: Nerd Font for powerline separators in background color mode
- Optional: `gh` CLI for PR segment

### Menu Bar App
- macOS 14.0+
- Xcode 15+ (for building)
- jq (for hook scripts): `brew install jq`

## License

MIT
