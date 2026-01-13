import Foundation

enum SessionStatus: String, Codable {
    case working
    case waiting
    case discovered  // Pre-existing session found by discovery, not yet confirmed by hooks
    case unknown
}

struct Session: Identifiable, Codable {
    var id: String { cwd }  // cwd is the primary key
    let cwd: String
    var gitBranch: String?
    var status: SessionStatus
    let firstSeenAt: Date
    var lastSeenAt: Date

    // Computed properties for display
    var projectName: String {
        URL(fileURLWithPath: cwd).lastPathComponent
    }

    /// Path displayed as parent/project (e.g., "repos/chud" instead of "~/repos/chud")
    var abbreviatedPath: String {
        let components = cwd.split(separator: "/").map(String.init)
        guard components.count >= 2 else {
            return cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~")
        }
        // Return last two components: parent/project
        return components.suffix(2).joined(separator: "/")
    }

    /// Parent directory for grouping (e.g., "~/repos" from "~/repos/chud")
    var parentDirectory: String {
        let url = URL(fileURLWithPath: cwd)
        let parent = url.deletingLastPathComponent().path
        return parent.replacingOccurrences(of: NSHomeDirectory(), with: "~")
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
        cwd: String,
        gitBranch: String?,
        status: String,
        firstSeenAt: Int64,
        lastSeenAt: Int64
    ) {
        self.cwd = cwd
        self.gitBranch = gitBranch
        self.status = SessionStatus(rawValue: status) ?? .unknown
        self.firstSeenAt = Date(timeIntervalSince1970: Double(firstSeenAt) / 1000)
        self.lastSeenAt = Date(timeIntervalSince1970: Double(lastSeenAt) / 1000)
    }
}
