import Foundation
import Observation

/// Manages cached GitHub PR data with TTL-based refresh.
/// Shows cached data immediately on tab switch, refreshes in background when stale.
@Observable
class PRCacheManager {
    var openPRs: [GitHubPR] = []
    var weekMergedPRs: [GitHubPR] = []
    var isLoading = false
    var isRefreshing = false
    var lastFetchedAt: Date?

    private let githubClient = GitHubClient()
    private let cacheTTL: TimeInterval = 300 // 5 minutes

    // MARK: - Computed Properties

    var todayMergedPRs: [GitHubPR] {
        let central = TimeZone(identifier: "America/Chicago")!
        var calendar = Calendar.current
        calendar.timeZone = central
        return weekMergedPRs.filter { pr in
            guard let mergedAt = pr.mergedAt else { return false }
            return calendar.isDateInToday(mergedAt)
        }
    }

    var openCount: Int { openPRs.count }
    var todayCount: Int { todayMergedPRs.count }
    var weekCount: Int { weekMergedPRs.count }

    // MARK: - Refresh Logic

    /// Refreshes data if needed: first load shows spinner, stale data refreshes in background.
    func refreshIfNeeded() {
        if lastFetchedAt == nil {
            // First load — no cached data
            isLoading = true
            fetchAllInBackground()
        } else if isStale {
            // Have cached data but it's stale — background refresh
            isRefreshing = true
            fetchAllInBackground()
        }
        // Otherwise fresh — no-op
    }

    /// Ignores TTL and fetches immediately (background refresh).
    func forceRefresh() {
        isRefreshing = true
        fetchAllInBackground()
    }

    private var isStale: Bool {
        guard let lastFetch = lastFetchedAt else { return true }
        return Date().timeIntervalSince(lastFetch) > cacheTTL
    }

    private func fetchAllInBackground() {
        DispatchQueue.global(qos: .userInitiated).async { [self] in
            let open = githubClient.getOpenPRs()
            let merged = githubClient.getMergedPRsThisWeek()

            DispatchQueue.main.async {
                self.openPRs = open
                self.weekMergedPRs = merged
                self.lastFetchedAt = Date()
                self.isLoading = false
                self.isRefreshing = false
            }
        }
    }
}
