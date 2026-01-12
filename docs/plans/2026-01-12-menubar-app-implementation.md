# Menu Bar App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a macOS menu bar app to monitor all active Claude Code sessions with real-time status updates.

**Architecture:** Monorepo with shared SQLite database. Hooks write session state to DB and push HTTP notifications. Swift menu bar app reads DB and listens for HTTP updates.

**Tech Stack:** Swift/SwiftUI (menu bar), TypeScript/Bun (statusline), SQLite (shared DB), Claude Code hooks (shell scripts)

---

## Task 1: Restructure to Monorepo

**Files:**
- Create: `apps/statusline/` directory
- Move: All existing source files to `apps/statusline/`
- Modify: `apps/statusline/package.json` (update paths)
- Create: `apps/menubar/.gitkeep` (placeholder)
- Create: `hooks/.gitkeep` (placeholder)

**Step 1: Create directory structure**

```bash
mkdir -p apps/statusline apps/menubar hooks
```

**Step 2: Move statusline files**

```bash
mv src apps/statusline/
mv package.json apps/statusline/
mv tsconfig.json apps/statusline/
mv bun.lock apps/statusline/
```

**Step 3: Update package.json bin path**

In `apps/statusline/package.json`, the bin entry stays the same (relative):
```json
{
  "bin": {
    "cc-hud": "src/index.ts"
  }
}
```

**Step 4: Reinstall dependencies**

```bash
cd apps/statusline && bun install && cd ../..
```

**Step 5: Test statusline still works**

```bash
echo '{}' | bun apps/statusline/src/index.ts
```
Expected: Statusline output renders (or empty string if no DB)

**Step 6: Update user settings path**

Note: Users with `~/.claude/settings.json` pointing to old path need to update:
```json
{
  "statusLine": {
    "command": "bun /path/to/cc-hud/apps/statusline/src/index.ts"
  }
}
```

**Step 7: Add placeholder files**

```bash
touch apps/menubar/.gitkeep hooks/.gitkeep
```

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: restructure to monorepo with apps/ directory"
```

---

## Task 2: Extend Database Schema

**Files:**
- Modify: `apps/statusline/src/database/client.ts:40-56`
- Modify: `apps/statusline/src/database/types.ts`

**Step 1: Update types**

Add to `apps/statusline/src/database/types.ts`:

```typescript
/**
 * Session status for menu bar app
 */
export type SessionStatus = 'working' | 'waiting' | 'unknown';

/**
 * Extended session data for menu bar sharing
 */
export interface HudSession {
  session_id: string;
  initial_cwd: string;
  git_branch: string | null;
  status: SessionStatus;
  is_root_at_start: boolean;
  first_seen_at: number;
  last_seen_at: number;
}
```

**Step 2: Update schema in client.ts**

In `apps/statusline/src/database/client.ts`, update `initializeSessionsTable()`:

```typescript
private initializeSessionsTable(): void {
  if (!this.db) return;

  try {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hud_sessions (
        session_id TEXT PRIMARY KEY,
        initial_cwd TEXT NOT NULL,
        git_branch TEXT,
        status TEXT DEFAULT 'unknown',
        is_root_at_start INTEGER NOT NULL,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )
    `);

    // Migration: add new columns if they don't exist
    this.db.exec(`
      ALTER TABLE hud_sessions ADD COLUMN git_branch TEXT;
    `).catch(() => {}); // Ignore if already exists

    this.db.exec(`
      ALTER TABLE hud_sessions ADD COLUMN status TEXT DEFAULT 'unknown';
    `).catch(() => {}); // Ignore if already exists
  } catch (error) {
    console.error(\`[cc-hud] Failed to create hud_sessions table: \${error}\`);
  }
}
```

**Step 3: Handle migration errors gracefully**

Actually, Bun SQLite doesn't have `.catch()` on exec. Update to:

```typescript
private initializeSessionsTable(): void {
  if (!this.db) return;

  try {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hud_sessions (
        session_id TEXT PRIMARY KEY,
        initial_cwd TEXT NOT NULL,
        git_branch TEXT,
        status TEXT DEFAULT 'unknown',
        is_root_at_start INTEGER NOT NULL,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )
    `);
  } catch (error) {
    console.error(`[cc-hud] Failed to create hud_sessions table: ${error}`);
  }

  // Migration: add new columns if they don't exist (ignore errors)
  try {
    this.db.exec(`ALTER TABLE hud_sessions ADD COLUMN git_branch TEXT`);
  } catch (_) { /* Column already exists */ }

  try {
    this.db.exec(`ALTER TABLE hud_sessions ADD COLUMN status TEXT DEFAULT 'unknown'`);
  } catch (_) { /* Column already exists */ }
}
```

**Step 4: Test schema migration**

```bash
cd apps/statusline && echo '{}' | bun src/index.ts
```

Then verify columns exist:
```bash
sqlite3 ~/.claude/statusline-usage.db ".schema hud_sessions"
```
Expected: Schema includes `git_branch` and `status` columns

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): extend hud_sessions schema with git_branch and status"
```

---

## Task 3: Create Hook Scripts

**Files:**
- Create: `hooks/session-start.sh`
- Create: `hooks/session-update.sh`
- Create: `hooks/session-end.sh`
- Create: `hooks/lib.sh` (shared functions)

**Step 1: Create shared library**

Create `hooks/lib.sh`:

```bash
#!/bin/bash
# Shared functions for cc-hud hooks

DB_PATH="${HOME}/.claude/statusline-usage.db"
MENUBAR_URL="http://localhost:19222"

# Get git branch for a directory
get_git_branch() {
  local dir="$1"
  git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
}

# Update session in database
db_upsert_session() {
  local session_id="$1"
  local cwd="$2"
  local git_branch="$3"
  local status="$4"
  local now=$(date +%s)000  # milliseconds

  sqlite3 "$DB_PATH" "
    INSERT INTO hud_sessions (session_id, initial_cwd, git_branch, status, is_root_at_start, first_seen_at, last_seen_at)
    VALUES ('$session_id', '$cwd', '$git_branch', '$status', 0, $now, $now)
    ON CONFLICT(session_id) DO UPDATE SET
      git_branch = '$git_branch',
      status = '$status',
      last_seen_at = $now;
  "
}

# Delete session from database
db_delete_session() {
  local session_id="$1"
  sqlite3 "$DB_PATH" "DELETE FROM hud_sessions WHERE session_id = '$session_id';"
}

# Notify menu bar app (fire-and-forget)
notify_menubar() {
  local event="$1"
  local session_id="$2"
  local cwd="$3"
  local git_branch="$4"
  local status="$5"

  curl -s -X POST "$MENUBAR_URL/session-update" \
    -H "Content-Type: application/json" \
    -d "{
      \"event\": \"$event\",
      \"session_id\": \"$session_id\",
      \"cwd\": \"$cwd\",
      \"git_branch\": \"$git_branch\",
      \"status\": \"$status\"
    }" &>/dev/null &
}
```

**Step 2: Create session-start hook**

Create `hooks/session-start.sh`:

```bash
#!/bin/bash
# Hook: SessionStart - called when Claude Code session starts or resumes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Read hook input from stdin
input=$(cat)

# Parse session info from environment
session_id="${CLAUDE_SESSION_ID:-unknown}"
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git_branch=$(get_git_branch "$cwd")
status="working"

# 1. Write to database (blocking)
db_upsert_session "$session_id" "$cwd" "$git_branch" "$status"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "start" "$session_id" "$cwd" "$git_branch" "$status"

exit 0
```

**Step 3: Create session-update hook (for idle_prompt notification)**

Create `hooks/session-update.sh`:

```bash
#!/bin/bash
# Hook: Notification (idle_prompt) - called when Claude is waiting for input
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Parse session info from environment
session_id="${CLAUDE_SESSION_ID:-unknown}"
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git_branch=$(get_git_branch "$cwd")
status="waiting"

# 1. Write to database (blocking)
db_upsert_session "$session_id" "$cwd" "$git_branch" "$status"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "update" "$session_id" "$cwd" "$git_branch" "$status"

exit 0
```

**Step 4: Create session-end hook**

Create `hooks/session-end.sh`:

```bash
#!/bin/bash
# Hook: SessionEnd - called when Claude Code session ends
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Parse session info from environment
session_id="${CLAUDE_SESSION_ID:-unknown}"
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Delete from database (blocking)
db_delete_session "$session_id"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "end" "$session_id" "$cwd" "" ""

exit 0
```

**Step 5: Make scripts executable**

```bash
chmod +x hooks/*.sh
```

**Step 6: Test hooks manually**

```bash
export CLAUDE_SESSION_ID="test-123"
export CLAUDE_PROJECT_DIR="/Users/jp/repos/cc-hud"
./hooks/session-start.sh < /dev/null
sqlite3 ~/.claude/statusline-usage.db "SELECT * FROM hud_sessions WHERE session_id='test-123';"
```
Expected: Row with session_id='test-123', status='working'

```bash
./hooks/session-update.sh < /dev/null
sqlite3 ~/.claude/statusline-usage.db "SELECT status FROM hud_sessions WHERE session_id='test-123';"
```
Expected: status='waiting'

```bash
./hooks/session-end.sh < /dev/null
sqlite3 ~/.claude/statusline-usage.db "SELECT * FROM hud_sessions WHERE session_id='test-123';"
```
Expected: No rows returned

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(hooks): add session lifecycle hooks for menu bar integration"
```

---

## Task 4: Create Swift Menu Bar App - Project Setup

**Files:**
- Create: `apps/menubar/CCMenubar.xcodeproj`
- Create: `apps/menubar/CCMenubar/` directory structure

**Step 1: Create Xcode project**

Open Xcode and create new project:
1. File > New > Project
2. macOS > App
3. Product Name: `CCMenubar`
4. Team: (your team or Personal Team)
5. Organization Identifier: `com.cc-hud`
6. Interface: SwiftUI
7. Language: Swift
8. Uncheck: Include Tests (add later)
9. Location: `/Users/jp/repos/cc-hud/apps/menubar/`

**Step 2: Verify project structure**

```bash
ls -la apps/menubar/
```
Expected: `CCMenubar/` folder and `CCMenubar.xcodeproj`

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(menubar): initialize Swift menu bar app project"
```

---

## Task 5: Menu Bar App - Models

**Files:**
- Create: `apps/menubar/CCMenubar/Models/Session.swift`
- Create: `apps/menubar/CCMenubar/Models/SessionEvent.swift`

**Step 1: Create Session model**

Create `apps/menubar/CCMenubar/Models/Session.swift`:

```swift
import Foundation

enum SessionStatus: String, Codable {
    case working
    case waiting
    case unknown
}

struct Session: Identifiable, Codable {
    let id: String  // session_id
    let cwd: String
    let gitBranch: String?
    var status: SessionStatus
    let firstSeenAt: Date
    var lastSeenAt: Date

    // Computed properties for display
    var projectName: String {
        URL(fileURLWithPath: cwd).lastPathComponent
    }

    var abbreviatedPath: String {
        cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~")
    }

    var timeSinceLastActivity: String {
        let interval = Date().timeIntervalSince(lastSeenAt)
        if interval < 60 {
            return "now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        }
    }

    // For database mapping
    init(
        sessionId: String,
        cwd: String,
        gitBranch: String?,
        status: String,
        firstSeenAt: Int64,
        lastSeenAt: Int64
    ) {
        self.id = sessionId
        self.cwd = cwd
        self.gitBranch = gitBranch
        self.status = SessionStatus(rawValue: status) ?? .unknown
        self.firstSeenAt = Date(timeIntervalSince1970: Double(firstSeenAt) / 1000)
        self.lastSeenAt = Date(timeIntervalSince1970: Double(lastSeenAt) / 1000)
    }
}
```

**Step 2: Create SessionEvent model**

Create `apps/menubar/CCMenubar/Models/SessionEvent.swift`:

```swift
import Foundation

struct SessionEvent: Codable {
    let event: String  // "start", "update", "end"
    let sessionId: String
    let cwd: String
    let gitBranch: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case event
        case sessionId = "session_id"
        case cwd
        case gitBranch = "git_branch"
        case status
    }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(menubar): add Session and SessionEvent models"
```

---

## Task 6: Menu Bar App - Database Client

**Files:**
- Create: `apps/menubar/CCMenubar/Services/DatabaseClient.swift`

**Step 1: Create DatabaseClient**

Create `apps/menubar/CCMenubar/Services/DatabaseClient.swift`:

```swift
import Foundation
import SQLite3

class DatabaseClient {
    private var db: OpaquePointer?
    private let dbPath: String

    init() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        dbPath = homeDir.appendingPathComponent(".claude/statusline-usage.db").path
    }

    func open() -> Bool {
        guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
            print("[CCMenubar] Failed to open database at \(dbPath)")
            return false
        }
        return true
    }

    func close() {
        if db != nil {
            sqlite3_close(db)
            db = nil
        }
    }

    func getAllSessions() -> [Session] {
        guard open() else { return [] }
        defer { close() }

        var sessions: [Session] = []
        let query = """
            SELECT session_id, initial_cwd, git_branch, status,
                   is_root_at_start, first_seen_at, last_seen_at
            FROM hud_sessions
            ORDER BY last_seen_at DESC
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
            print("[CCMenubar] Failed to prepare query")
            return []
        }
        defer { sqlite3_finalize(statement) }

        while sqlite3_step(statement) == SQLITE_ROW {
            let sessionId = String(cString: sqlite3_column_text(statement, 0))
            let cwd = String(cString: sqlite3_column_text(statement, 1))
            let gitBranch = sqlite3_column_text(statement, 2).map { String(cString: $0) }
            let status = sqlite3_column_text(statement, 3).map { String(cString: $0) } ?? "unknown"
            let firstSeenAt = sqlite3_column_int64(statement, 5)
            let lastSeenAt = sqlite3_column_int64(statement, 6)

            let session = Session(
                sessionId: sessionId,
                cwd: cwd,
                gitBranch: gitBranch,
                status: status,
                firstSeenAt: firstSeenAt,
                lastSeenAt: lastSeenAt
            )
            sessions.append(session)
        }

        return sessions
    }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(menubar): add SQLite database client"
```

---

## Task 7: Menu Bar App - Session Manager

**Files:**
- Create: `apps/menubar/CCMenubar/Services/SessionManager.swift`

**Step 1: Create SessionManager**

Create `apps/menubar/CCMenubar/Services/SessionManager.swift`:

```swift
import Foundation

@MainActor
class SessionManager: ObservableObject {
    @Published var sessions: [Session] = []

    private let dbClient = DatabaseClient()

    init() {
        refresh()
    }

    func refresh() {
        sessions = dbClient.getAllSessions()
    }

    func handleEvent(_ event: SessionEvent) {
        switch event.event {
        case "start", "update":
            if let index = sessions.firstIndex(where: { $0.id == event.sessionId }) {
                // Update existing session
                sessions[index].status = SessionStatus(rawValue: event.status ?? "unknown") ?? .unknown
                sessions[index].lastSeenAt = Date()
            } else {
                // Add new session
                let session = Session(
                    sessionId: event.sessionId,
                    cwd: event.cwd,
                    gitBranch: event.gitBranch,
                    status: event.status ?? "unknown",
                    firstSeenAt: Int64(Date().timeIntervalSince1970 * 1000),
                    lastSeenAt: Int64(Date().timeIntervalSince1970 * 1000)
                )
                sessions.insert(session, at: 0)
            }
        case "end":
            sessions.removeAll { $0.id == event.sessionId }
        default:
            break
        }
    }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(menubar): add SessionManager for state management"
```

---

## Task 8: Menu Bar App - HTTP Server

**Files:**
- Create: `apps/menubar/CCMenubar/Services/HTTPServer.swift`

**Step 1: Create HTTPServer**

Create `apps/menubar/CCMenubar/Services/HTTPServer.swift`:

```swift
import Foundation
import Network

class HTTPServer {
    private var listener: NWListener?
    private let port: UInt16 = 19222
    var onSessionEvent: ((SessionEvent) -> Void)?

    func start() {
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
        } catch {
            print("[CCMenubar] Failed to create listener: \(error)")
            return
        }

        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }

        listener?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("[CCMenubar] HTTP server listening on port \(self.port)")
            case .failed(let error):
                print("[CCMenubar] HTTP server failed: \(error)")
            default:
                break
            }
        }

        listener?.start(queue: .main)
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .main)

        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, error in
            if let data = data, let request = String(data: data, encoding: .utf8) {
                self?.handleRequest(request, connection: connection)
            }
            connection.cancel()
        }
    }

    private func handleRequest(_ request: String, connection: NWConnection) {
        // Parse HTTP request to extract JSON body
        let lines = request.components(separatedBy: "\r\n")

        // Find the empty line that separates headers from body
        if let emptyLineIndex = lines.firstIndex(of: "") {
            let bodyLines = lines[(emptyLineIndex + 1)...]
            let body = bodyLines.joined(separator: "\r\n")

            if let jsonData = body.data(using: .utf8) {
                do {
                    let event = try JSONDecoder().decode(SessionEvent.self, from: jsonData)
                    DispatchQueue.main.async {
                        self.onSessionEvent?(event)
                    }
                } catch {
                    print("[CCMenubar] Failed to decode event: \(error)")
                }
            }
        }

        // Send HTTP 200 response
        let response = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed({ _ in }))
    }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(menubar): add HTTP server for hook notifications"
```

---

## Task 9: Menu Bar App - Views

**Files:**
- Modify: `apps/menubar/CCMenubar/CCMenubarApp.swift`
- Create: `apps/menubar/CCMenubar/Views/SessionRowView.swift`
- Create: `apps/menubar/CCMenubar/Views/MenuBarView.swift`

**Step 1: Create SessionRowView**

Create `apps/menubar/CCMenubar/Views/SessionRowView.swift`:

```swift
import SwiftUI

struct SessionRowView: View {
    let session: Session

    var statusColor: Color {
        switch session.status {
        case .waiting:
            return .green
        case .working:
            return .yellow
        case .unknown:
            return .gray
        }
    }

    var statusIcon: String {
        switch session.status {
        case .waiting:
            return "●"
        case .working:
            return "◐"
        case .unknown:
            return "○"
        }
    }

    var body: some View {
        HStack {
            Text(statusIcon)
                .foregroundColor(statusColor)
                .font(.system(size: 12, weight: .bold, design: .monospaced))

            Text(session.projectName)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .frame(width: 120, alignment: .leading)
                .lineLimit(1)

            Text(session.abbreviatedPath)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.secondary)
                .lineLimit(1)

            if let branch = session.gitBranch, !branch.isEmpty {
                Text("(\(branch))")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(session.timeSinceLastActivity)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }
}
```

**Step 2: Create MenuBarView**

Create `apps/menubar/CCMenubar/Views/MenuBarView.swift`:

```swift
import SwiftUI

struct MenuBarView: View {
    @ObservedObject var sessionManager: SessionManager

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if sessionManager.sessions.isEmpty {
                Text("No active sessions")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding()
            } else {
                ForEach(sessionManager.sessions) { session in
                    SessionRowView(session: session)
                }
            }

            Divider()
                .padding(.vertical, 4)

            Button(action: {
                sessionManager.refresh()
            }) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Refresh")
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)

            Divider()
                .padding(.vertical, 4)

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
        .frame(width: 450)
        .padding(.vertical, 8)
    }
}
```

**Step 3: Update main app**

Replace contents of `apps/menubar/CCMenubar/CCMenubarApp.swift`:

```swift
import SwiftUI

@main
struct CCMenubarApp: App {
    @StateObject private var sessionManager = SessionManager()
    private let httpServer = HTTPServer()

    init() {
        httpServer.onSessionEvent = { [self] event in
            Task { @MainActor in
                sessionManager.handleEvent(event)
            }
        }
        httpServer.start()
    }

    var body: some Scene {
        MenuBarExtra {
            MenuBarView(sessionManager: sessionManager)
        } label: {
            Image(systemName: "terminal")
        }
        .menuBarExtraStyle(.window)
    }
}
```

**Step 4: Build and test**

In Xcode:
1. Open `apps/menubar/CCMenubar.xcodeproj`
2. Build (Cmd+B)
3. Run (Cmd+R)

Expected: Menu bar icon appears, clicking shows empty session list with Refresh button

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(menubar): add SwiftUI views and wire up app"
```

---

## Task 10: Integration Testing

**Step 1: Configure Claude Code hooks**

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/jp/repos/cc-hud/hooks/session-start.sh"
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
            "command": "/Users/jp/repos/cc-hud/hooks/session-update.sh"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/jp/repos/cc-hud/hooks/session-end.sh"
          }
        ]
      }
    ]
  }
}
```

**Step 2: Start menu bar app**

Run from Xcode or build and run:
```bash
open apps/menubar/CCMenubar.xcodeproj
# Then Cmd+R in Xcode
```

**Step 3: Start a Claude Code session**

```bash
cd ~/repos/cc-hud && claude
```

**Step 4: Verify session appears in menu bar**

Click the terminal icon in menu bar.
Expected: Session shows with green dot (waiting), project name, path, branch

**Step 5: Verify status updates**

In Claude Code, give a command that takes time (e.g., "explain this codebase").
Expected: Menu bar shows yellow dot (working) while processing.

When Claude finishes, wait 60+ seconds.
Expected: Menu bar shows green dot (waiting) again.

**Step 6: Verify session end**

Exit Claude Code (`/exit` or Ctrl+C).
Expected: Session disappears from menu bar list.

**Step 7: Final commit**

```bash
git add -A
git commit -m "docs: add hook configuration for integration testing"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Restructure to monorepo |
| 2 | Extend database schema |
| 3 | Create hook scripts |
| 4 | Create Swift project |
| 5 | Add data models |
| 6 | Add database client |
| 7 | Add session manager |
| 8 | Add HTTP server |
| 9 | Add SwiftUI views |
| 10 | Integration testing |

Total: ~10 tasks, estimated 60-90 minutes to implement.
