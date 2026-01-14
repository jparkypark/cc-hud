# CLAUDE.md

Monorepo with two apps for monitoring Claude Code sessions:

- **Statusline** (`apps/statusline/`) - TypeScript/Bun, renders status bar in Claude Code
- **chud** (`apps/overlay/`) - Swift/SwiftUI, native macOS overlay with Sessions, Analytics, and PRs tabs

Both share SQLite at `~/.claude/statusline-usage.db`.

## Commands

```bash
mise run install                      # Install both
mise run install overlay              # Build + install chud to /Applications
mise run install overlay --autostart  # Install + enable launch on login
mise run install statusline           # Install dependencies
mise run configure                    # Configure Claude Code to use statusline
mise run autostart [enable|disable|status]  # Manage auto-start
```

## Key Files

- Statusline entry: `apps/statusline/src/index.ts`
- chud entry: `apps/overlay/chud/chud/chudApp.swift`
- Hooks: `hooks/*.sh` (write to SQLite + POST to chud HTTP server on :19222)
- Statusline config: `~/.claude/chud.json`
- chud config: `~/.claude/chud-overlay.json` (written by `mise run install overlay`)
