# CLAUDE.md

Monorepo with two apps for monitoring Claude Code sessions:

- **Statusline** (`apps/statusline/`) - TypeScript/Bun, renders status bar in Claude Code
- **cchud** (`apps/overlay/`) - Swift/SwiftUI, native macOS overlay for viewing all sessions

Both share SQLite at `~/.claude/statusline-usage.db`.

## Commands

```bash
mise run install                      # Install both
mise run install menubar              # Build + install cchud to /Applications
mise run install menubar --autostart  # Install + enable launch on login
mise run install statusline           # Install dependencies
mise run configure                    # Configure Claude Code to use statusline
mise run autostart [enable|disable|status]  # Manage auto-start
```

## Key Files

- Statusline entry: `apps/statusline/src/index.ts`
- cchud entry: `apps/overlay/cchud/cchud/cchudApp.swift`
- Hooks: `hooks/*.sh` (write to SQLite + POST to cchud HTTP server on :19222)
- Statusline config: `~/.claude/cchud.json`
- cchud config: `~/.claude/cchud-overlay.json` (written by `mise run install menubar`)
