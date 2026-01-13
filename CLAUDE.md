# CLAUDE.md

Monorepo with two apps for monitoring Claude Code sessions:

- **Statusline** (`apps/statusline/`) - TypeScript/Bun, renders status bar in Claude Code
- **Menu Bar App** (`apps/menubar/`) - Swift/SwiftUI, native macOS app showing all sessions

Both share SQLite at `~/.claude/statusline-usage.db`.

## Commands

```bash
just install              # Install both
just install menubar      # Build + install to /Applications + relaunch
just install statusline   # Install dependencies
```

## Key Files

- Statusline entry: `apps/statusline/src/index.ts`
- Menubar entry: `apps/menubar/CCMenubar/CCMenubar/CCMenubarApp.swift`
- Hooks: `hooks/*.sh` (write to SQLite + POST to menubar HTTP server on :19222)
- Config: `~/.claude/cc-hud.json`
