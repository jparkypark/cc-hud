import Foundation

/// Represents a merged pull request
struct MergedPR: Identifiable {
    let id: String
    let title: String
    let repo: String
    let org: String
    let url: String
    let mergedAt: Date?
}

/// Client for fetching GitHub PR data via the gh CLI
class GitHubClient {
    private var cachedUsername: String?

    /// Gets the current GitHub username
    func getUsername() -> String? {
        if let cached = cachedUsername {
            return cached
        }

        let result = runGhCommand(["api", "user", "--jq", ".login"])
        cachedUsername = result?.trimmingCharacters(in: .whitespacesAndNewlines)
        return cachedUsername
    }

    /// Fetches merged PRs authored by the current user for a specific date
    /// - Parameter date: The date to query (in local timezone)
    /// - Returns: Array of merged PRs
    func getMergedPRs(for date: Date) -> [MergedPR] {
        guard let username = getUsername() else { return [] }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "America/Chicago")
        let dateString = formatter.string(from: date)

        let args = [
            "search", "prs",
            "--author=\(username)",
            "--merged-at=\(dateString)",
            "--json", "repository,title,url,updatedAt",
            "--limit", "100"
        ]

        guard let output = runGhCommand(args) else { return [] }
        return parsePRsJSON(output)
    }

    /// Fetches merged PRs authored by the current user for the current week
    /// - Returns: Array of merged PRs
    func getMergedPRsThisWeek() -> [MergedPR] {
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
        return parsePRsJSON(output)
    }

    /// Runs a gh CLI command and returns the output
    private func runGhCommand(_ args: [String]) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["gh"] + args

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
    private func parsePRsJSON(_ json: String) -> [MergedPR] {
        guard let data = json.data(using: .utf8) else { return [] }

        do {
            guard let array = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                return []
            }

            return array.compactMap { item -> MergedPR? in
                guard let repo = item["repository"] as? [String: Any],
                      let repoName = repo["name"] as? String,
                      let nameWithOwner = repo["nameWithOwner"] as? String,
                      let title = item["title"] as? String,
                      let url = item["url"] as? String else {
                    return nil
                }

                let org = nameWithOwner.split(separator: "/").first.map(String.init) ?? ""
                let id = url  // Use URL as unique ID

                // Parse updatedAt as a proxy for mergedAt
                var mergedAt: Date?
                if let updatedAtString = item["updatedAt"] as? String {
                    let formatter = ISO8601DateFormatter()
                    mergedAt = formatter.date(from: updatedAtString)
                }

                return MergedPR(
                    id: id,
                    title: title,
                    repo: repoName,
                    org: org,
                    url: url,
                    mergedAt: mergedAt
                )
            }
            .sorted { ($0.mergedAt ?? .distantPast) > ($1.mergedAt ?? .distantPast) }
        } catch {
            print("[chud] Failed to parse PR JSON: \(error)")
            return []
        }
    }
}
