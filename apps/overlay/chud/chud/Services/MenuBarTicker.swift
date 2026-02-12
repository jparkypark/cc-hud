import Foundation
import Observation

/// Independently fetches usage and pace data on a configurable interval.
/// Runs the statusline script in standalone mode to refresh the DB, then reads it.
@Observable
class MenuBarTicker {
    var dailyCost: Double = 0
    var pace: Double = 0

    private let dbClient = DatabaseClient()
    private var timer: Timer?
    private let statuslineScript: String
    private let refreshInterval: TimeInterval

    var tickerText: String {
        let costStr = "$\(Int(dailyCost))"
        let paceStr = "$\(Int(pace))/hr"
        return "\(costStr) \u{00B7} \(paceStr)"
    }

    init() {
        // Load config
        let config = Self.loadConfig()
        self.statuslineScript = config.statuslineScript
        self.refreshInterval = config.refreshInterval

        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: refreshInterval, repeats: true) { [weak self] _ in
            self?.refresh()
        }
    }

    func refresh() {
        DispatchQueue.global(qos: .utility).async { [self] in
            // Run statusline in standalone mode to fetch fresh data and write to DB
            self.runStatusline()

            // Read fresh data from DB
            let usage = self.dbClient.getDailyUsage(days: 1)
            let paceSnapshots = self.dbClient.getPaceSnapshots(days: 1)

            DispatchQueue.main.async {
                if let today = usage.last {
                    self.dailyCost = today.cost
                }
                if let latest = paceSnapshots.last {
                    self.pace = latest.pace
                }
            }
        }
    }

    private func runStatusline() {
        let bunPath = Self.findBunPath()
        guard let bun = bunPath else {
            print("[chud] bun not found, skipping statusline refresh")
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: bun)
        process.arguments = [statuslineScript, "--standalone", "--cache-ttl", "\(Int(refreshInterval))"]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            print("[chud] Failed to run statusline: \(error)")
        }
    }

    private static func findBunPath() -> String? {
        let paths = [
            "\(NSHomeDirectory())/.bun/bin/bun",
            "/opt/homebrew/bin/bun",
            "/usr/local/bin/bun",
        ]
        return paths.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    private struct TickerConfig {
        let statuslineScript: String
        let refreshInterval: TimeInterval
    }

    private static func loadConfig() -> TickerConfig {
        let configPath = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".claude/chud-overlay.json")

        var statuslineScript = "\(NSHomeDirectory())/repos/chud/apps/statusline/src/index.ts"
        var refreshInterval: TimeInterval = 300

        if let data = try? Data(contentsOf: configPath),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let script = json["statuslineScript"] as? String {
                statuslineScript = script
            }
            if let interval = json["tickerInterval"] as? Double {
                refreshInterval = interval
            }
        }

        return TickerConfig(statuslineScript: statuslineScript, refreshInterval: refreshInterval)
    }
}
