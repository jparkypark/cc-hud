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

    /// Path displayed as parent/project (e.g., "repos/cc-hud" instead of "~/repos/cc-hud")
    var abbreviatedPath: String {
        let components = cwd.split(separator: "/").map(String.init)
        guard components.count >= 2 else {
            return cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~")
        }
        // Return last two components: parent/project
        return components.suffix(2).joined(separator: "/")
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
