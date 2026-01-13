import Foundation
import SQLite3

/// Client for reading session data from the shared SQLite database.
/// Uses the SQLite3 C API directly for maximum compatibility.
class DatabaseClient {
    private var db: OpaquePointer?
    private let dbPath: String

    init() {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        dbPath = homeDir.appendingPathComponent(".claude/statusline-usage.db").path
    }

    /// Opens a connection to the database.
    /// - Returns: `true` if successful, `false` otherwise.
    func open() -> Bool {
        guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
            print("[cchud] Failed to open database at \(dbPath)")
            return false
        }
        return true
    }

    /// Closes the database connection.
    func close() {
        if db != nil {
            sqlite3_close(db)
            db = nil
        }
    }

    /// Retrieves all sessions from the database, ordered by most recent activity.
    /// - Returns: Array of Session objects, empty if database cannot be opened or query fails.
    func getAllSessions() -> [Session] {
        guard open() else { return [] }
        defer { close() }

        var sessions: [Session] = []
        let query = """
            SELECT cwd, git_branch, status, first_seen_at, last_seen_at
            FROM hud_sessions
            ORDER BY last_seen_at DESC
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
            print("[cchud] Failed to prepare query")
            return []
        }
        defer { sqlite3_finalize(statement) }

        while sqlite3_step(statement) == SQLITE_ROW {
            // Column 0: cwd (TEXT PRIMARY KEY)
            let cwd = String(cString: sqlite3_column_text(statement, 0))

            // Column 1: git_branch (TEXT, can be NULL)
            let gitBranch: String?
            if let gitBranchPtr = sqlite3_column_text(statement, 1) {
                gitBranch = String(cString: gitBranchPtr)
            } else {
                gitBranch = nil
            }

            // Column 2: status (TEXT, defaults to "unknown")
            let status: String
            if let statusPtr = sqlite3_column_text(statement, 2) {
                status = String(cString: statusPtr)
            } else {
                status = "unknown"
            }

            // Column 3: first_seen_at (INTEGER NOT NULL)
            let firstSeenAt = sqlite3_column_int64(statement, 3)

            // Column 4: last_seen_at (INTEGER NOT NULL)
            let lastSeenAt = sqlite3_column_int64(statement, 4)

            let session = Session(
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
