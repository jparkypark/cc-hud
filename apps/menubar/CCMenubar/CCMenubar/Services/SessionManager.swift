import Foundation
import Observation

/// Manages the state of all active Claude Code sessions.
/// Observes the shared SQLite database and handles real-time HTTP event notifications.
@Observable
class SessionManager {
    /// All currently active sessions, ordered by most recent activity.
    var sessions: [Session] = []

    /// Database client for reading session data.
    private let dbClient = DatabaseClient()

    init() {
        refresh()
    }

    /// Refreshes the session list from the database.
    func refresh() {
        sessions = dbClient.getAllSessions()
    }

    /// Handles a session event received via HTTP from the hooks.
    /// Updates the in-memory session list immediately for responsive UI.
    /// - Parameter event: The session event to process.
    func handleEvent(_ event: SessionEvent) {
        switch event.event {
        case "start", "update":
            if let index = sessions.firstIndex(where: { $0.id == event.sessionId }) {
                // Update existing session in place
                sessions[index].status = SessionStatus(rawValue: event.status ?? "unknown") ?? .unknown
                sessions[index].lastSeenAt = Date()
            } else {
                // Add new session at the beginning (most recent)
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
            // Remove the session from the list
            sessions.removeAll { $0.id == event.sessionId }
        default:
            // Unknown event type, ignore
            break
        }
    }
}
