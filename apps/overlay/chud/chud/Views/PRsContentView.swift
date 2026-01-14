import SwiftUI

enum PRTimeRange: String, CaseIterable {
    case today = "Today"
    case week = "This Week"
}

struct PRsContentView: View {
    @State private var timeRange: PRTimeRange = .today
    @State private var todayPRs: [MergedPR] = []
    @State private var weekPRs: [MergedPR] = []
    @State private var isLoading = false
    @State private var hasLoaded = false

    private let githubClient = GitHubClient()

    private var displayedPRs: [MergedPR] {
        timeRange == .today ? todayPRs : weekPRs
    }

    private var prsGroupedByOrg: [(org: String, prs: [MergedPR])] {
        let grouped = Dictionary(grouping: displayedPRs, by: { $0.org })
        return grouped.map { (org: $0.key, prs: $0.value) }
            .sorted { $0.prs.count > $1.prs.count }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Summary header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Merged PRs")
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))

                    if hasLoaded {
                        Text("\(todayPRs.count) today, \(weekPRs.count) this week")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Time range toggle
                Picker("Time Range", selection: $timeRange) {
                    ForEach(PRTimeRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 160)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)

            Divider()

            // Content
            if isLoading {
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
            } else if displayedPRs.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary)
                    Text("No PRs merged \(timeRange == .today ? "today" : "this week")")
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
            if !hasLoaded {
                loadData()
            }
        }
    }

    private func loadData() {
        isLoading = true

        DispatchQueue.global(qos: .userInitiated).async {
            let today = self.githubClient.getMergedPRs(for: Date())
            let week = self.githubClient.getMergedPRsThisWeek()

            DispatchQueue.main.async {
                self.todayPRs = today
                self.weekPRs = week
                self.isLoading = false
                self.hasLoaded = true
            }
        }
    }
}

// MARK: - PR Group View

struct PRGroupView: View {
    let org: String
    let prs: [MergedPR]

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
    let pr: MergedPR

    var body: some View {
        Button(action: {
            if let url = URL(string: pr.url) {
                NSWorkspace.shared.open(url)
            }
        }) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "arrow.triangle.merge")
                    .font(.system(size: 11))
                    .foregroundColor(.purple)
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

                if let mergedAt = pr.mergedAt {
                    Text(formatTime(mergedAt))
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

        // If today, show time; otherwise show date
        if Calendar.current.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
        } else {
            formatter.dateFormat = "MMM d"
        }

        return formatter.string(from: date)
    }
}
