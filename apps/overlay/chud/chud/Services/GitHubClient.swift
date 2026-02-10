import Foundation

enum PRState {
    case open
    case merged
}

/// Represents a GitHub pull request (open or merged)
struct GitHubPR: Identifiable {
    let id: String
    let title: String
    let repo: String
    let org: String
    let url: String
    let state: PRState
    let createdAt: Date?
    let mergedAt: Date?

    /// Converts GitHub PR URL to Graphite equivalent
    /// e.g. https://github.com/org/repo/pull/123 → https://app.graphite.dev/github/pr/org/repo/123
    var graphiteUrl: String {
        let parts = url.split(separator: "/")
        // URL format: https://github.com/<org>/<repo>/pull/<number>
        guard parts.count >= 5,
              let number = parts.last,
              parts[parts.count - 2] == "pull" else {
            return url
        }
        return "https://app.graphite.dev/github/pr/\(org)/\(repo)/\(number)"
    }
}

/// Client for fetching GitHub PR data via the gh CLI
class GitHubClient {
    private var cachedUsername: String?
    private var ghPath: String?

    /// Finds the gh CLI executable in common locations
    private func findGhPath() -> String? {
        if let cached = ghPath {
            return cached
        }

        let commonPaths = [
            "/opt/homebrew/bin/gh",      // Apple Silicon Homebrew
            "/usr/local/bin/gh",          // Intel Homebrew
            "/usr/bin/gh",                // System install
            "\(NSHomeDirectory())/.local/bin/gh"  // User local install
        ]

        for path in commonPaths {
            if FileManager.default.isExecutableFile(atPath: path) {
                ghPath = path
                return path
            }
        }

        return nil
    }

    /// Gets the current GitHub username
    func getUsername() -> String? {
        if let cached = cachedUsername {
            return cached
        }

        let result = runGhCommand(["api", "user", "--jq", ".login"])
        cachedUsername = result?.trimmingCharacters(in: .whitespacesAndNewlines)
        return cachedUsername
    }

    /// Fetches open PRs authored by the current user
    func getOpenPRs() -> [GitHubPR] {
        guard let username = getUsername() else { return [] }

        let args = [
            "search", "prs",
            "--author=\(username)",
            "--state=open",
            "--json", "repository,title,url,createdAt",
            "--limit", "100"
        ]

        guard let output = runGhCommand(args) else { return [] }
        return parsePRsJSON(output, state: .open)
    }

    /// Fetches merged PRs authored by the current user for the current week
    func getMergedPRsThisWeek() -> [GitHubPR] {
        guard let username = getUsername() else { return [] }

        // Get start of current week (Sunday) in Central timezone
        let calendar = Calendar.current
        var calendarCentral = calendar
        calendarCentral.timeZone = TimeZone(identifier: "America/Chicago")!

        let today = Date()
        let weekday = calendarCentral.component(.weekday, from: today)
        let daysFromSunday = weekday - 1

        guard let startOfWeek = calendarCentral.date(byAdding: .day, value: -daysFromSunday, to: today) else {
            return []
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "America/Chicago")

        let startDate = formatter.string(from: startOfWeek)
        let endDate = formatter.string(from: today)

        let args = [
            "search", "prs",
            "--author=\(username)",
            "--merged-at=\(startDate)..\(endDate)",
            "--json", "repository,title,url,updatedAt",
            "--limit", "100"
        ]

        guard let output = runGhCommand(args) else { return [] }
        return parsePRsJSON(output, state: .merged)
    }

    /// Runs a gh CLI command and returns the output
    private func runGhCommand(_ args: [String]) -> String? {
        guard let path = findGhPath() else {
            print("[chud] gh CLI not found in common locations")
            return nil
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = args

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()

            if process.terminationStatus != 0 {
                return nil
            }

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8)
        } catch {
            print("[chud] Failed to run gh command: \(error)")
            return nil
        }
    }

    /// Parses the JSON output from gh search prs
    private func parsePRsJSON(_ json: String, state: PRState) -> [GitHubPR] {
        guard let data = json.data(using: .utf8) else { return [] }

        do {
            guard let array = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                return []
            }

            let isoFormatter = ISO8601DateFormatter()

            return array.compactMap { item -> GitHubPR? in
                guard let repo = item["repository"] as? [String: Any],
                      let repoName = repo["name"] as? String,
                      let nameWithOwner = repo["nameWithOwner"] as? String,
                      let title = item["title"] as? String,
                      let url = item["url"] as? String else {
                    return nil
                }

                let org = nameWithOwner.split(separator: "/").first.map(String.init) ?? ""
                let id = url  // Use URL as unique ID

                var createdAt: Date?
                if let createdAtString = item["createdAt"] as? String {
                    createdAt = isoFormatter.date(from: createdAtString)
                }

                var mergedAt: Date?
                if let updatedAtString = item["updatedAt"] as? String {
                    mergedAt = isoFormatter.date(from: updatedAtString)
                }

                return GitHubPR(
                    id: id,
                    title: title,
                    repo: repoName,
                    org: org,
                    url: url,
                    state: state,
                    createdAt: createdAt,
                    mergedAt: state == .merged ? mergedAt : nil
                )
            }
            .sorted {
                let dateA = ($0.mergedAt ?? $0.createdAt ?? .distantPast)
                let dateB = ($1.mergedAt ?? $1.createdAt ?? .distantPast)
                return dateA > dateB
            }
        } catch {
            print("[chud] Failed to parse PR JSON: \(error)")
            return []
        }
    }
}
