# Menu Bar App Design

**Date:** 2026-01-12
**Status:** Approved

## Overview

A macOS menu bar app to monitor all active Claude Code sessions, showing their status, working directory, git branch, and time since last activity.

## Problem Statement

When running 3-5+ Claude Code sessions concurrently across multiple terminal windows and virtual desktops, it's difficult to:
1. Know which sessions are waiting for input
2. See all sessions at a glance with relevant metadata

## Solution

A native macOS menu bar app that displays a dropdown list of all active Claude Code sessions with status indicators.

## Architecture

### Monorepo Structure

```
cc-hud/
├── apps/
│   ├── statusline/              # Existing cc-hud code
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── menubar/                 # New Swift app
│       ├── CCMenubar/
│       │   ├── CCMenubarApp.swift
│       │   ├── SessionManager.swift
│       │   ├── HTTPServer.swift
│       │   ├── Models/
│       │   └── Views/
│       └── CCMenubar.xcodeproj
│
├── hooks/                       # Shared Claude Code hooks
│   ├── session-start.sh
│   ├── session-end.sh
│   └── notification.sh
│
└── docs/
```

### Data Flow

```
Hook fires
  1. Write to SQLite (blocking, waits for commit)
  2. POST to HTTP with same data (fire-and-forget)

Menu bar app
  - Uses HTTP payload for immediate UI update
  - Reads DB on startup and refresh
```

This approach provides:
- Real-time updates via HTTP push
- Persistence via shared SQLite database
- Graceful degradation if HTTP fails
- Shared state between statusline and menu bar

### Database Schema

Extended `hud_sessions` table in `~/.claude/statusline-usage.db`:

```sql
CREATE TABLE hud_sessions (
  session_id TEXT PRIMARY KEY,
  initial_cwd TEXT NOT NULL,
  git_branch TEXT,
  status TEXT DEFAULT 'unknown',  -- 'working', 'waiting', 'unknown'
  is_root_at_start INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
)
```

### Claude Code Hooks

| Hook | Event | Action |
|------|-------|--------|
| `SessionStart` | `startup`, `resume` | Insert/update session, status='working' |
| `Notification` | `idle_prompt` | Update status='waiting' |
| `SessionEnd` | Session terminates | Delete session row |

Hook script pattern:
```bash
#!/bin/bash
# 1. Write to SQLite (synchronous, blocks until committed)
sqlite3 ~/.claude/statusline-usage.db "UPDATE hud_sessions SET ..."

# 2. Notify menu bar with same data (fire-and-forget)
curl -s -X POST localhost:19222/session-update \
  -H "Content-Type: application/json" \
  -d '{"session_id":"...", "status":"...", ...}' &>/dev/null || true
```

### HTTP API

Menu bar app runs HTTP server on `localhost:19222`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/session-update` | POST | Receive session state updates from hooks |

Payload:
```json
{
  "event": "start|update|end",
  "session_id": "uuid",
  "cwd": "/path/to/project",
  "git_branch": "main",
  "status": "working|waiting"
}
```

## UI Design

### Menu Bar Dropdown

```
● my-project        ~/repos/my-project (main)        2m ago
◐ spacewalker       ~/agents/spacewalker (feat/x)    now
● secondbrain       ~/repos/secondbrain (dev)        45s ago
─────────────────────────────────────────────────────────────
↻ Refresh
```

### Status Indicators

| Indicator | Color | Meaning |
|-----------|-------|---------|
| ● | Green | Waiting for input |
| ◐ | Yellow | Working |
| ○ | Gray | Stale/unknown |

### Row Information

1. Status indicator (colored dot)
2. Project name (derived from directory basename)
3. Path (abbreviated)
4. Git branch (in parentheses)
5. Time since last activity

### Interactions

- Click on session row: No action (deferred)
- Click Refresh: Re-read database, update UI

## Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| UI Framework | SwiftUI + MenuBarExtra | Modern Apple framework, clean menu bar API |
| System APIs | AppKit (via SwiftUI) | Required for future window switching |
| HTTP Server | Swift NIO or built-in | Lightweight, native |
| Database | SQLite (shared) | Already used by cc-hud, cross-process safe |

## Deferred Features

### macOS Notifications
Push notifications when sessions become ready for input. Deferred to focus on core monitoring functionality first.

### Window Switching
Click session to switch to corresponding Warp terminal window. Investigation revealed:
- Warp lacks AppleScript support
- No API to target specific tabs/windows
- Would require hacky UI scripting workarounds

## Race Condition Mitigation

HTTP notification could theoretically arrive before DB write commits. Mitigated by:
1. Hook writes to DB synchronously (blocks until committed)
2. Hook includes full data in HTTP payload
3. Menu bar uses HTTP payload for immediate update
4. DB is authoritative for refresh/startup

## Open Questions

None - design is complete and approved.

## References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks.md)
- [Warp AppleScript Issue](https://github.com/warpdotdev/Warp/issues/3364)
