# Migration Guide

Instructions for migrating from cc-hud to chud (or from menubar to overlay commands).

## Quick Migration

Paste this to Claude Code:

```
Help me migrate to chud. Do the following:

1. Remove old LaunchAgents:
   - launchctl unload ~/Library/LaunchAgents/com.cc-hud.menubar.plist 2>/dev/null
   - launchctl unload ~/Library/LaunchAgents/com.chud.menubar.plist 2>/dev/null
   - rm -f ~/Library/LaunchAgents/com.cc-hud.menubar.plist
   - rm -f ~/Library/LaunchAgents/com.chud.menubar.plist

2. Update hooks in ~/.claude/settings.json to point to the new chud repo location (replace /path/to/chud with actual path):
   - SessionStart: /path/to/chud/hooks/session-start.sh
   - UserPromptSubmit: /path/to/chud/hooks/prompt-submit.sh
   - Notification (idle_prompt): /path/to/chud/hooks/session-update.sh
   - Stop: /path/to/chud/hooks/session-end.sh

3. Update statusLine command in ~/.claude/settings.json:
   - bun /path/to/chud/apps/statusline/src/index.ts

4. Rebuild and install the overlay:
   - mise run install overlay

5. Optionally enable auto-start:
   - mise run autostart enable
```

## Manual Steps

### 1. Clean Up Old LaunchAgents

```bash
# Unload and remove old LaunchAgents
launchctl unload ~/Library/LaunchAgents/com.cc-hud.menubar.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.chud.menubar.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.cc-hud.menubar.plist
rm -f ~/Library/LaunchAgents/com.chud.menubar.plist
```

### 2. Update Claude Code Settings

Edit `~/.claude/settings.json` and update paths from the old location to the new `chud` repo location.

**Hooks section:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/chud/hooks/session-start.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/chud/hooks/prompt-submit.sh"
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
            "command": "/path/to/chud/hooks/session-update.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/chud/hooks/session-end.sh"
          }
        ]
      }
    ]
  }
}
```

**Statusline section:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "bun /path/to/chud/apps/statusline/src/index.ts"
  }
}
```

Or run `mise run configure` from the chud repo to auto-update the statusLine config.

### 3. Reinstall the Overlay

```bash
cd /path/to/chud
mise run install overlay
```

### 4. Enable Auto-Start (Optional)

```bash
mise run autostart enable
```

### 5. Restart Claude Code

Restart Claude Code for settings changes to take effect.

## Config Files

These config files remain compatible and don't need changes:

| File | Purpose |
|------|---------|
| `~/.claude/chud.json` | Statusline configuration |
| `~/.claude/chud-overlay.json` | Overlay app configuration |
| `~/.claude/statusline-usage.db` | Shared SQLite database |

## Command Changes

| Old Command | New Command |
|-------------|-------------|
| `mise run install menubar` | `mise run install overlay` |
| `mise run install menubar --autostart` | `mise run install overlay --autostart` |

## Troubleshooting

### Hooks not working after migration

Verify hook paths are correct:
```bash
cat ~/.claude/settings.json | jq '.hooks'
```

### Old overlay still running

Kill any old processes:
```bash
pkill -x chud
pkill -x CCMenubar
```

Then relaunch:
```bash
open /Applications/chud.app
```

### Database errors

The database schema hasn't changed. If you encounter errors, you can reset:
```bash
rm ~/.claude/statusline-usage.db
# Restart Claude Code - hooks will recreate the table
```
