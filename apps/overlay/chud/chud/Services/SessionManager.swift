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

    /// Timer for periodic UI refresh (updates time display).
    private var refreshTimer: Timer?

    /// Path to the discovery script, loaded from config.
    private let discoveryScriptPath: String? = {
        let configPath = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".claude/chud-overlay.json")

        guard let data = try? Data(contentsOf: configPath),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let hooksDir = json["hooksDir"] as? String else {
            return nil
        }

        return "\(hooksDir)/discover-sessions.sh"
    }()

    init() {
        cleanupStaleSessionsFromBeforeBoot()
        refresh()
        startRefreshTimer()
    }

    /// Cleans up sessions from before the current system boot.
    /// This handles the case where the computer restarted but the database persisted.
    private func cleanupStaleSessionsFromBeforeBoot() {
        var boottime = timeval()
        var size = MemoryLayout<timeval>.size
        if sysctlbyname("kern.boottime", &boottime, &size, nil, 0) == 0 {
            let bootTimeMs = Int64(boottime.tv_sec) * 1000 + Int64(boottime.tv_usec) / 1000
            dbClient.deleteSessionsOlderThan(bootTimeMs)
        }
    }

    /// Starts a timer to refresh the UI every 60 seconds.
    private func startRefreshTimer() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.refreshUI()
        }
    }

    /// Triggers a UI refresh without re-running discovery.
    private func refreshUI() {
        // Re-assign to trigger @Observable update for computed properties
        let current = sessions
        sessions = current
    }

    /// Refreshes the session list from the database.
    /// First runs discovery to find any running sessions not yet registered.
    func refresh() {
        discoverSessions()
        sessions = dbClient.getAllSessions().sorted { $0.abbreviatedPath < $1.abbreviatedPath }
    }

    /// Runs the discovery script to find running Claude sessions.
    private func discoverSessions() {
        guard let scriptPath = discoveryScriptPath else {
            print("[chud] Discovery script path not configured")
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [scriptPath]

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            print("[chud] Failed to run discovery script: \(error)")
        }
    }

    /// Handles a session event received via HTTP from the hooks.
    /// Updates the in-memory session list immediately for responsive UI.
    /// - Parameter event: The session event to process.
    func handleEvent(_ event: SessionEvent) {
        switch event.event {
        case "start", "update":
            if let index = sessions.firstIndex(where: { $0.cwd == event.cwd }) {
                // Update existing session
                sessions[index].gitBranch = event.gitBranch
                sessions[index].status = SessionStatus(rawValue: event.status ?? "unknown") ?? .unknown
                sessions[index].lastSeenAt = Date()
            } else {
                // Add new session and maintain alphabetical order
                let session = Session(
                    cwd: event.cwd,
                    gitBranch: event.gitBranch,
                    status: event.status ?? "unknown",
                    firstSeenAt: Int64(Date().timeIntervalSince1970 * 1000),
                    lastSeenAt: Int64(Date().timeIntervalSince1970 * 1000)
                )
                sessions.append(session)
                sessions.sort { $0.abbreviatedPath < $1.abbreviatedPath }
            }
        case "end":
            // Remove the session by cwd
            sessions.removeAll { $0.cwd == event.cwd }
        default:
            // Unknown event type, ignore
            break
        }
    }
}
