import SwiftUI

struct PRsContentView: View {
    var prCacheManager: PRCacheManager

    private var allPRs: [GitHubPR] {
        let combined = prCacheManager.openPRs + prCacheManager.weekMergedPRs
        return combined.sorted {
            let dateA = ($0.mergedAt ?? $0.createdAt ?? .distantPast)
            let dateB = ($1.mergedAt ?? $1.createdAt ?? .distantPast)
            return dateA > dateB
        }
    }

    private var prsGroupedByOrg: [(org: String, prs: [GitHubPR])] {
        let grouped = Dictionary(grouping: allPRs, by: { $0.org })
        return grouped.map { (org: $0.key, prs: $0.value) }
            .sorted { $0.prs.count > $1.prs.count }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Summary header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Text("Pull Requests")
                            .font(.system(size: 14, weight: .semibold, design: .monospaced))

                        if prCacheManager.isRefreshing {
                            ProgressView()
                                .scaleEffect(0.5)
                                .frame(width: 12, height: 12)
                        }
                    }

                    if prCacheManager.lastFetchedAt != nil {
                        Text("\(prCacheManager.openCount) open \u{00B7} \(prCacheManager.todayCount) today \u{00B7} \(prCacheManager.weekCount) this week")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)

            Divider()

            // Content
            if prCacheManager.isLoading {
                Spacer()
                HStack {
                    Spacer()
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading...")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.secondary)
                    Spacer()
                }
                Spacer()
            } else if allPRs.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary)
                    Text("No open or recently merged PRs")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(prsGroupedByOrg, id: \.org) { group in
                            PRGroupView(org: group.org, prs: group.prs)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            prCacheManager.refreshIfNeeded()
        }
    }
}

// MARK: - PR Group View

struct PRGroupView: View {
    let org: String
    let prs: [GitHubPR]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Org header
            HStack {
                Text(org)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundColor(.secondary)

                Text("(\(prs.count))")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary.opacity(0.7))
            }

            // PR list
            ForEach(prs) { pr in
                PRRowView(pr: pr)
            }
        }
    }
}

// MARK: - PR Row View

struct PRRowView: View {
    let pr: GitHubPR

    var body: some View {
        Button(action: {
            if let url = URL(string: pr.graphiteUrl) {
                NSWorkspace.shared.open(url)
            }
        }) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: pr.state == .open ? "circle.fill" : "arrow.triangle.merge")
                    .font(.system(size: 11))
                    .foregroundColor(pr.state == .open ? .green : .purple)
                    .frame(width: 16)

                VStack(alignment: .leading, spacing: 2) {
                    Text(pr.title)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(pr.repo)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                }

                Spacer()

                if let date = pr.mergedAt ?? pr.createdAt {
                    Text(formatTime(date))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.primary.opacity(0.05))
            )
        }
        .buttonStyle(.plain)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(identifier: "America/Chicago")

        if Calendar.current.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
        } else {
            formatter.dateFormat = "MMM d"
        }

        return formatter.string(from: date)
    }
}
