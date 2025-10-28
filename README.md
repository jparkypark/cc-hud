# cc-hud

A customizable heads-up display for Claude Code with live daily totals, flexible segment ordering, and powerline styling.

## Why cc-hud?

Existing Claude Code statusline packages don't offer enough customization:
- Can't control what info is displayed within segments (only color theming)
- Can't reorder segments
- Limited or no access to live daily cost tracking

cc-hud fixes this by giving you:
- ✅ **Granular display control** - Show/hide any piece of info per segment
- ✅ **Flexible segment ordering** - Arrange segments however you want
- ✅ **Live daily totals** - Accurate cost tracking using ccusage library
- ✅ **Full color customization** - Control foreground, background, and separator colors
- ✅ **Multiple powerline styles** - Choose from 6 separator styles with automatic color compensation
- ✅ **Flexible path display** - Show directory name, full path, or project-relative path

## Installation

```bash
bun install -g cc-hud
```

Or use without installing:

```bash
bunx cc-hud
```

## Quick Start

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

2. Create your config file:

```json
// ~/.claude/cc-hud.json
{
  "segments": [
    {
      "type": "usage",
      "display": {
        "icon": true,
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
        "pathMode": "project"
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

3. Restart Claude Code to see your new statusline!

## Configuration

The config file location is `~/.claude/cc-hud.json`.

Structure:
- `segments` - Array of segment objects in display order (left to right)
- `theme.powerline` - Enable powerline separators (default: true)
- `theme.separatorStyle` - Choose from 6 separator styles (default: "angled")

Each segment requires:
- `type` - Segment type (usage, directory, git)
- `display` - Object controlling what info to show (varies by segment type)
- `colors.fg` - Foreground color (hex format)
- `colors.bg` - Background color (hex format)

### Color Themes

Popular themes that work well:

**Tokyo Night** (used in development):
```json
{
  "segments": [
    { "type": "usage", "colors": { "fg": "#1a1b26", "bg": "#f7768e" } },
    { "type": "directory", "colors": { "fg": "#1a1b26", "bg": "#9ece6a" } },
    { "type": "git", "colors": { "fg": "#1a1b26", "bg": "#7aa2f7" } }
  ]
}
```

**Gruvbox**:
```json
{
  "segments": [
    { "type": "usage", "colors": { "fg": "#282828", "bg": "#fb4934" } },
    { "type": "directory", "colors": { "fg": "#282828", "bg": "#b8bb26" } },
    { "type": "git", "colors": { "fg": "#282828", "bg": "#83a598" } }
  ]
}
```

## Available Segments

### Usage
Daily cost and token usage calculated from Claude transcripts using the [ccusage](https://github.com/jparkerweb/ccusage) library.

Display options:
- `icon` - Show ☉ (alchemical symbol for gold)
- `cost` - Show daily cost in dollars
- `tokens` - Show total token count (formatted with K/M suffix)
- `period` - Label to show (e.g., "today")

### Directory
Current working directory with flexible path display modes.

Display options:
- `icon` - Show › symbol
- `pathMode` - How to display the path:
  - `"name"` - Just the directory name (default)
  - `"full"` - Full path with ~ for home directory
  - `"project"` - Path from project root (e.g., `cc-hud/src`)

### Git
Git repository information.

Display options:
- `icon` - Show ⎇ symbol
- `branch` - Show current branch name
- `status` - Show clean (✓) or dirty (✗) indicator
- `ahead` - Show commits ahead with ↑ symbol
- `behind` - Show commits behind with ↓ symbol

## Separator Styles

Six powerline separator styles are available. All separators automatically apply 10% color darkening to compensate for font rendering making thin glyphs appear lighter.

- `angled` - Classic powerline chevrons (default)
- `thin` - Subtle outlined separators
- `rounded` - Smooth rounded transitions
- `flame` - Decorative flame-style separators
- `slant` - Forward-slanting diagonal separators
- `backslant` - Backward-slanting diagonal separators

## Documentation

- [Design Decisions](docs/DESIGN.md) - Why we made the choices we did
- [Architecture](docs/ARCHITECTURE.md) - Technical implementation details

## Requirements

- Bun 1.0+ (already installed if you use Claude Code)
- Claude Code
- Terminal with Unicode support (most modern terminals)
- Font with powerline glyphs (Comic Code Ligatures, any Nerd Font, or many monospace fonts)

## License

MIT
