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
- ✅ **Live daily totals** - Real-time cost tracking from Claude's database
- ✅ **Full color customization** - Control foreground, background, and separator colors
- ✅ **Multiple powerline styles** - Choose from angled, thin, rounded, or flame separators

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

3. Restart Claude Code to see your new statusline!

## Available Segments

- **usage** - Daily cost and token usage from Claude's database
- **directory** - Current working directory with optional icon
- **git** - Git branch, status, ahead/behind counts

## Separator Styles

- `angled` - Classic powerline look (default)
- `thin` - Subtle thin separators
- `rounded` - Smooth rounded transitions
- `flame` - Decorative flame-style separators

## Documentation

- [Design Decisions](docs/DESIGN.md) - Why we made the choices we did
- [Architecture](docs/ARCHITECTURE.md) - Technical implementation details

## Requirements

- Bun 1.0+ (already installed if you use Claude Code)
- Claude Code
- Terminal with Nerd Font support (for icons and powerline characters)

## License

MIT
