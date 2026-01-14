import SwiftUI

enum PanelTab: String, CaseIterable {
    case sessions = "Sessions"
    case analytics = "Analytics"

    var icon: String {
        switch self {
        case .sessions: return "rectangle.stack"
        case .analytics: return "chart.bar.xaxis"
        }
    }
}

struct PanelContainerView: View {
    @State private var selectedTab: PanelTab = .sessions
    var sessionManager: SessionManager
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Tab bar
            HStack(spacing: 0) {
                ForEach(PanelTab.allCases, id: \.self) { tab in
                    TabButton(
                        tab: tab,
                        isSelected: selectedTab == tab,
                        action: { selectedTab = tab }
                    )
                }
                Spacer()

                // Close button
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .padding(.trailing, 12)
            }
            .padding(.top, 8)
            .padding(.bottom, 4)

            Divider()

            // Content
            switch selectedTab {
            case .sessions:
                SessionsContentView(sessionManager: sessionManager)
            case .analytics:
                AnalyticsContentView()
            }
        }
        .frame(width: 520, height: 720)
    }
}

// MARK: - Tab Button

struct TabButton: View {
    let tab: PanelTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: tab.icon)
                    .font(.system(size: 11))
                Text(tab.rawValue)
                    .font(.system(size: 12, weight: isSelected ? .semibold : .regular, design: .monospaced))
            }
            .foregroundColor(isSelected ? .primary : .secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.accentColor.opacity(0.15) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Sessions Content (extracted from FloatingPanelView)

struct SessionsContentView: View {
    var sessionManager: SessionManager

    var body: some View {
        VStack(spacing: 0) {
            if sessionManager.sessions.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "tray")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary)
                    Text("No active sessions")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 1) {
                        ForEach(sessionManager.sessions) { session in
                            SessionRowView(session: session)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Analytics Content (simplified wrapper)

struct AnalyticsContentView: View {
    @State private var timeRange: TimeRange = .month
    @State private var heatmapData: [HeatmapCell] = []
    @State private var projectData: [ProjectTime] = []

    private let dbClient = DatabaseClient()
    private let days = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Time range picker
            HStack {
                Spacer()
                Picker("Time Range", selection: $timeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.label).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)

            // Activity Heatmap
            VStack(alignment: .leading, spacing: 8) {
                Text("Activity")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)

                HeatmapGrid(data: heatmapData, days: days)
            }
            .padding(.horizontal, 16)

            Divider()
                .padding(.horizontal, 16)

            // Project Breakdown
            VStack(alignment: .leading, spacing: 8) {
                Text("Projects")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)

                ProjectBreakdownChart(data: Array(projectData.prefix(8)))
            }
            .padding(.horizontal, 16)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: timeRange) { _, newValue in
            loadData(days: newValue.rawValue)
        }
        .onAppear {
            loadData(days: timeRange.rawValue)
        }
    }

    private func loadData(days: Int) {
        heatmapData = dbClient.getActivityHeatmap(days: days)
        projectData = dbClient.getProjectBreakdown(days: days)
    }
}
