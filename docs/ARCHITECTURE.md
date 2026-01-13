# Architecture

This document describes the technical implementation of cc-hud.

## Overview

cc-hud is a monorepo containing two applications:

1. **Statusline** (TypeScript/Bun) - A command-line tool that renders a customizable status bar for Claude Code
2. **cchud Overlay** (Swift/SwiftUI) - A native macOS app that displays all active Claude Code sessions

Both applications share a SQLite database for session state.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Claude Code                                                                         │
│                                                                                     │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │SessionStart │  │UserPromptSubmit │  │ Notification │  │ Stop                 │  │
│  │ Hook        │  │ Hook            │  │ Hook (idle)  │  │ Hook                 │  │
│  └──────┬──────┘  └───────┬─────────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                   │                     │               │
└─────────┼─────────────────┼───────────────────┼─────────────────────┼───────────────┘
          │                 │                   │                     │
          ▼                 ▼                   ▼                     ▼
     ┌────────────────────────────────────────────────────────────────────────────┐
     │ Hook Scripts (hooks/)                                                      │
     │                                                                            │
     │  1. Write to SQLite (blocking)                                             │
     │  2. POST to HTTP (fire-and-forget)                                         │
     └───────────────────────────────┬────────────────────────┬───────────────────┘
                       │                        │
                       ▼                        ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ SQLite Database              │    │ cchud Overlay HTTP Server     │
│ ~/.claude/statusline-usage.db│    │ localhost:19222              │
│                              │    │                              │
│ hud_sessions table           │    │ Receives real-time updates   │
└──────────────────────────────┘    └──────────────────────────────┘
            │                                    │
            │                                    │
            ▼                                    ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Statusline (TypeScript)      │    │ cchud Overlay (Swift)         │
│ apps/statusline/             │    │ apps/menubar/                │
│                              │    │                              │
│ Reads DB for session info    │    │ Reads DB on startup/refresh  │
│ Renders status bar           │    │ Uses HTTP for instant updates│
└──────────────────────────────┘    └──────────────────────────────┘
```

## Project Structure

```
cc-hud/
├── apps/
│   ├── statusline/               # TypeScript statusline app
│   │   ├── src/
│   │   │   ├── index.ts          # Main entry point
│   │   │   ├── segments/         # Segment implementations
│   │   │   │   ├── base.ts
│   │   │   │   ├── usage.ts
│   │   │   │   ├── pace.ts
│   │   │   │   ├── directory.ts
│   │   │   │   ├── git.ts
│   │   │   │   ├── pr.ts
│   │   │   │   ├── time.ts
│   │   │   │   └── thoughts.ts
│   │   │   ├── usage/
│   │   │   │   └── hourly-calculator.ts
│   │   │   ├── config/
│   │   │   │   ├── types.ts
│   │   │   │   ├── parser.ts
│   │   │   │   └── defaults.ts
│   │   │   ├── database/
│   │   │   │   ├── client.ts
│   │   │   │   └── types.ts
│   │   │   └── renderer/
│   │   │       ├── powerline.ts
│   │   │       └── separators.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── menubar/                  # Swift menu bar app
│       └── cchud/
│           └── cchud/
│               ├── cchudApp.swift
│               ├── Models/
│               │   ├── Session.swift
│               │   └── SessionEvent.swift
│               ├── Services/
│               │   ├── DatabaseClient.swift
│               │   ├── SessionManager.swift
│               │   └── HTTPServer.swift
│               └── Views/
│                   ├── MenuBarView.swift
│                   └── SessionRowView.swift
│
├── hooks/                        # Claude Code hooks
│   ├── lib.sh                    # Shared functions
│   ├── session-start.sh          # SessionStart hook
│   ├── prompt-submit.sh          # UserPromptSubmit hook
│   ├── session-update.sh         # Notification (idle_prompt) hook
│   ├── session-end.sh            # Stop hook
│   └── discover-sessions.sh      # Discovers running sessions on refresh
│
└── docs/
    ├── DESIGN.md
    ├── ARCHITECTURE.md
    └── plans/
```

## Database Schema

Shared SQLite database at `~/.claude/statusline-usage.db`:

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

## Session Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              Session Lifecycle                                    │
└──────────────────────────────────────────────────────────────────────────────────┘

  User starts        User sends         Claude             User sends       Session
  Claude Code        message            responds           message          ends
       │                 │                 │                  │               │
       ▼                 ▼                 ▼                  ▼               ▼
  ┌──────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────┐
  │SessionStart│    │UserPrompt │    │Notification│    │UserPrompt │    │  Stop  │
  │  Hook     │    │Submit Hook│    │  Hook      │    │Submit Hook│    │  Hook  │
  └─────┬─────┘    └─────┬──────┘    └─────┬──────┘    └─────┬──────┘    └────┬───┘
        │                │                 │                 │                │
        ▼                ▼                 ▼                 ▼                ▼
   working           working           waiting           working          DELETE
   (yellow)          (yellow)          (green)           (yellow)

  ────────────────────────────────────────────────────────────────────────────────►
                                       Time
```

**State transitions:**
1. Session starts → `working` (yellow) - Claude is processing
2. User sends message → `working` (yellow) - Claude is processing
3. Claude responds, waits for input → `waiting` (green) - Ready for user
4. Session ends → Removed from menu bar

## Component Details

### 1. Hooks (hooks/)

Shell scripts that Claude Code executes at lifecycle events.

**Environment variables provided by Claude Code:**

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAUDE_SESSION_ID` | Unique session identifier | `a1b2c3d4-e5f6-...` |
| `CLAUDE_WORKING_DIRECTORY` | Session's working directory | `/Users/you/repos/project` |

**lib.sh** - Shared functions:
- `escape_sql()` - Escape single quotes for SQL injection prevention
- `get_git_branch()` - Get current git branch for a directory
- `db_upsert_session()` - Insert or update session in database
- `db_delete_session()` - Remove session from database
- `notify_menubar()` - POST session update to menu bar app

**session-start.sh** - Called on SessionStart:
```bash
#!/bin/bash
source "$(dirname "$0")/lib.sh"

session_id="$CLAUDE_SESSION_ID"
cwd="$CLAUDE_WORKING_DIRECTORY"
git_branch=$(get_git_branch "$cwd")

db_upsert_session "$session_id" "$cwd" "$git_branch" "working"
notify_menubar "start" "$session_id" "$cwd" "$git_branch" "working"
```

**prompt-submit.sh** - Called on UserPromptSubmit:
```bash
#!/bin/bash
source "$(dirname "$0")/lib.sh"

session_id="$CLAUDE_SESSION_ID"
cwd="$CLAUDE_WORKING_DIRECTORY"
git_branch=$(get_git_branch "$cwd")

db_upsert_session "$session_id" "$cwd" "$git_branch" "working"
notify_menubar "update" "$session_id" "$cwd" "$git_branch" "working"
```

**session-update.sh** - Called on Notification (idle_prompt):
```bash
#!/bin/bash
source "$(dirname "$0")/lib.sh"

session_id="$CLAUDE_SESSION_ID"
cwd="$CLAUDE_WORKING_DIRECTORY"
git_branch=$(get_git_branch "$cwd")

db_upsert_session "$session_id" "$cwd" "$git_branch" "waiting"
notify_menubar "update" "$session_id" "$cwd" "$git_branch" "waiting"
```

**session-end.sh** - Called on Stop:
```bash
#!/bin/bash
source "$(dirname "$0")/lib.sh"

session_id="$CLAUDE_SESSION_ID"
cwd="$CLAUDE_WORKING_DIRECTORY"

db_delete_session "$session_id"
notify_menubar "end" "$session_id" "$cwd" "" ""
```

### 2. Statusline (apps/statusline/)

TypeScript application that renders the Claude Code status bar.

**Data Flow:**
1. Receives JSON from Claude Code via stdin
2. Loads config from `~/.claude/cc-hud.json`
3. Fetches usage data (ccusage + Codex CLI)
4. Calculates EWMA pace from transcript files
5. Renders segments with powerline styling
6. Outputs ANSI-colored string to stdout

**Key Components:**
- **Segment System** - Modular segment types (usage, pace, git, etc.)
- **EWMA Calculator** - Smoothed pace calculation with configurable half-life
- **Powerline Renderer** - Supports background and text-only color modes

### 3. cchud Overlay (apps/menubar/)

Native macOS app built with SwiftUI.

**Architecture:**
- **cchudApp.swift** - App entry point with MenuBarExtra
- **Session.swift** - Data model for sessions
- **SessionEvent.swift** - HTTP payload model
- **DatabaseClient.swift** - SQLite3 C API wrapper
- **SessionManager.swift** - @Observable state management
- **HTTPServer.swift** - Network framework TCP listener
- **MenuBarView.swift** - Main dropdown UI
- **SessionRowView.swift** - Individual session row

**Data Flow:**
1. On startup: Discover running sessions, read from SQLite database
2. On HTTP POST: Parse JSON, update in-memory session array
3. On Refresh click: Discover sessions, re-read database
4. Every 60 seconds: Refresh UI to update time display

**Session Discovery:**
- Runs `hooks/discover-sessions.sh` on startup and refresh
- Finds running Claude processes via `ps` and `lsof`
- Extracts session ID from most recent transcript file
- Registers sessions with "unknown" status (hooks will correct it)

**HTTP Server:**
- Listens on `localhost:19222`
- Accepts POST to `/session-update`
- Parses JSON payload into SessionEvent
- Updates SessionManager state

### 4. Data Synchronization

The hooks write to both SQLite and HTTP:

```
Hook fires
  1. Write to SQLite (blocking, waits for commit)
  2. POST to HTTP with same data (fire-and-forget)

Menu bar app
  - Uses HTTP payload for immediate UI update
  - Reads DB on startup and refresh (authoritative source)
```

This approach provides:
- Real-time updates via HTTP push
- Persistence via shared SQLite database
- Graceful degradation if HTTP fails
- Shared state between statusline and menu bar

## Statusline Details

### Segment System

**Base Interface:**

```typescript
export interface SegmentData {
  text: string;
  colors: { fg: string; bg: string; };
}

export abstract class Segment {
  abstract render(input: ClaudeCodeInput, db: DatabaseClient): SegmentData;
  async updateCache?(): Promise<void>;
}
```

**Available Segments:**
- UsageSegment - Daily cost (Claude Code + Codex)
- PaceSegment - EWMA hourly burn rate
- DirectorySegment - Current working directory
- GitSegment - Branch and status
- PrSegment - GitHub PR number
- TimeSegment - Current time
- ThoughtsSegment - Random quotes

### EWMA Pace Calculation

```typescript
function calculateEWMAPace(
  costs: TimestampedCost[],
  halfLifeMs: number,
  now: number
): number {
  let weightedCostSum = 0;

  for (const { timestamp, cost } of costs) {
    const ageMs = now - timestamp;
    const weight = Math.pow(2, -ageMs / halfLifeMs);
    weightedCostSum += cost * weight;
  }

  const effectiveWindowMs = halfLifeMs / Math.LN2;
  const effectiveWindowHours = effectiveWindowMs / (1000 * 60 * 60);

  return weightedCostSum / effectiveWindowHours;
}
```

### Theme System

The statusline supports automatic light/dark theme detection:

**detect.ts** - System theme detection:
- macOS: Reads `AppleInterfaceStyle` via `defaults` command
- Linux: Uses `COLORFGBG` environment variable
- Fallback: Defaults to dark theme

**themes.ts** - Theme color definitions:
- `DARK_THEME_COLORS` - Vibrant colors for dark backgrounds
- `LIGHT_THEME_COLORS` - Adjusted colors for light backgrounds
- `mergeThemeColors()` - Merges user overrides with base theme

**Config options:**
- `theme.themeMode`: 'auto' | 'light' | 'dark'
- `darkTheme`: Per-segment color overrides for dark mode
- `lightTheme`: Per-segment color overrides for light mode

### Powerline Renderer

Two color modes:
- **Background mode** - Colored backgrounds with powerline separators
- **Text mode** - Colored text only, pipe separators

## cchud Overlay Details

### Session Model

```swift
struct Session: Identifiable {
  let id: String
  let cwd: String
  let gitBranch: String?
  let status: SessionStatus
  let firstSeenAt: Date
  let lastSeenAt: Date

  var projectName: String { /* basename of cwd */ }
  var abbreviatedPath: String { /* ~/... format */ }
  var timeSinceLastActivity: String { /* "now", "2m ago", etc. */ }
}

enum SessionStatus: String {
  case working, waiting, unknown

  var color: Color { /* green, yellow, gray */ }
  var icon: String { /* filled/half circle */ }
}
```

### HTTP Server

Uses Network framework for lightweight TCP listening:

```swift
class HTTPServer {
  private var listener: NWListener?
  var onSessionEvent: ((SessionEvent) -> Void)?

  func start() throws {
    listener = try NWListener(using: .tcp, on: 19222)
    listener?.newConnectionHandler = { connection in
      self.handleConnection(connection)
    }
    listener?.start(queue: .main)
  }

  private func handleConnection(_ connection: NWConnection) {
    // Read HTTP request, parse JSON, call onSessionEvent
  }
}
```

### UI Components

**MenuBarView:**
```swift
struct MenuBarView: View {
  @Environment(SessionManager.self) var sessionManager

  var body: some View {
    if sessionManager.sessions.isEmpty {
      Text("No active sessions")
    } else {
      ForEach(sessionManager.sessions) { session in
        SessionRowView(session: session)
      }
    }
    Divider()
    Button("Refresh") { sessionManager.refresh() }
    Button("Quit") { NSApp.terminate(nil) }
  }
}
```

**SessionRowView:**
- Status indicator (colored circle)
- Project name
- Abbreviated path + git branch
- Time since last activity

## Performance

### Statusline Target: <100ms

- Bun startup: ~3-5ms
- Config load: ~1ms
- Usage fetch: ~50-100ms (parallel)
- Pace calculation: ~5-10ms
- Render: ~1ms

### cchud Overlay

- Startup: Read DB once
- HTTP updates: Instant UI refresh
- Memory: <20MB typical

## Error Handling

### Hooks
- SQLite errors: Logged to stderr, hook continues
- HTTP errors: Silently ignored (fire-and-forget)

### Statusline
- Missing config: Use defaults
- ccusage errors: Show $0
- Codex CLI missing: Silently skip

### cchud Overlay
- DB read errors: Show empty state
- HTTP parse errors: Ignore malformed requests
