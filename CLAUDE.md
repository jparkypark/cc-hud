# CLAUDE.md

Monorepo with two apps for monitoring Claude Code sessions:

- **Statusline** (`apps/statusline/`) - TypeScript/Bun, renders status bar in Claude Code
- **Menu Bar App** (`apps/menubar/`) - Swift/SwiftUI, native macOS app showing all sessions

Both share SQLite at `~/.claude/statusline-usage.db`.

## Commands

```bash
mise run install                      # Install both
mise run install menubar              # Build + install to /Applications + relaunch
mise run install menubar --autostart  # Install + enable launch on login
mise run install statusline           # Install dependencies
mise run configure                    # Configure Claude Code to use statusline
mise run autostart [enable|disable|status]  # Manage auto-start
```

## Key Files

- Statusline entry: `apps/statusline/src/index.ts`
- Menubar entry: `apps/menubar/CCMenubar/CCMenubar/CCMenubarApp.swift`
- Hooks: `hooks/*.sh` (write to SQLite + POST to menubar HTTP server on :19222)
- Statusline config: `~/.claude/cc-hud.json`
- Menubar config: `~/.claude/cc-hud-menubar.json` (written by `mise run install menubar`)
