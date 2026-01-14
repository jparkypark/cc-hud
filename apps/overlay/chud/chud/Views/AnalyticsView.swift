import SwiftUI

enum TimeRange: Int, CaseIterable {
    case week = 7
    case month = 28
    case quarter = 90

    var label: String {
        switch self {
        case .week: return "7 days"
        case .month: return "28 days"
        case .quarter: return "90 days"
        }
    }
}

struct AnalyticsView: View {
    @State private var timeRange: TimeRange = .month
    @State private var heatmapData: [HeatmapCell] = []
    @State private var projectData: [ProjectTime] = []

    private let dbClient = DatabaseClient()
    private let days = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header with time range picker
            HStack {
                Text("Analytics")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                Spacer()
                Picker("Time Range", selection: $timeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.label).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }

            Divider()

            // Activity Heatmap
            VStack(alignment: .leading, spacing: 8) {
                Text("Activity")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)

                HeatmapGrid(data: heatmapData, days: days)
            }

            Divider()

            // Project Breakdown
            VStack(alignment: .leading, spacing: 8) {
                Text("Projects")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(.secondary)

                ProjectBreakdownChart(data: Array(projectData.prefix(8)))
            }

            Spacer()
        }
        .padding(16)
        .frame(width: 400, height: 500)
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

// MARK: - Heatmap Grid

struct HeatmapGrid: View {
    let data: [HeatmapCell]
    let days: [String]

    private let cellSize: CGFloat = 14
    private let spacing: CGFloat = 2

    // Build a 2D grid: [hour][dayOfWeek] -> count
    private var grid: [[Int]] {
        var result = Array(repeating: Array(repeating: 0, count: 7), count: 24)
        for cell in data {
            if cell.hour >= 0 && cell.hour < 24 && cell.dayOfWeek >= 0 && cell.dayOfWeek < 7 {
                result[cell.hour][cell.dayOfWeek] = cell.count
            }
        }
        return result
    }

    private var maxCount: Int {
        data.map(\.count).max() ?? 1
    }

    var body: some View {
        HStack(alignment: .top, spacing: spacing) {
            // Hour labels
            VStack(spacing: spacing) {
                Text("")  // Spacer for day labels
                    .frame(height: cellSize)
                ForEach(0..<24, id: \.self) { hour in
                    if hour % 6 == 0 {
                        Text(String(format: "%02d", hour))
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundColor(.secondary)
                            .frame(width: 20, height: cellSize)
                    } else {
                        Text("")
                            .frame(width: 20, height: cellSize)
                    }
                }
            }

            // Grid columns (one per day)
            ForEach(0..<7, id: \.self) { dayIndex in
                VStack(spacing: spacing) {
                    // Day label
                    Text(days[dayIndex])
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                        .frame(height: cellSize)

                    // Hour cells
                    ForEach(0..<24, id: \.self) { hour in
                        let count = grid[hour][dayIndex]
                        let intensity = maxCount > 0 ? Double(count) / Double(maxCount) : 0

                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.blue.opacity(0.1 + intensity * 0.9))
                            .frame(width: cellSize, height: cellSize)
                    }
                }
            }
        }
    }
}

// MARK: - Project Breakdown Chart

struct ProjectBreakdownChart: View {
    let data: [ProjectTime]

    private var maxMinutes: Int {
        data.map(\.totalMinutes).max() ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if data.isEmpty {
                Text("No data")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)
            } else {
                ForEach(data, id: \.cwd) { project in
                    HStack(spacing: 8) {
                        // Project name (abbreviated)
                        Text(abbreviatePath(project.cwd))
                            .font(.system(size: 11, design: .monospaced))
                            .lineLimit(1)
                            .frame(width: 140, alignment: .leading)

                        // Bar
                        GeometryReader { geometry in
                            let barWidth = maxMinutes > 0
                                ? CGFloat(project.totalMinutes) / CGFloat(maxMinutes) * geometry.size.width
                                : 0

                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.blue.opacity(0.7))
                                .frame(width: barWidth, height: 12)
                        }
                        .frame(height: 12)

                        // Time label
                        Text(formatTime(project.totalMinutes))
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.secondary)
                            .frame(width: 50, alignment: .trailing)
                    }
                }
            }
        }
    }

    private func abbreviatePath(_ path: String) -> String {
        let components = path.split(separator: "/")
        if components.count >= 2 {
            return components.suffix(2).joined(separator: "/")
        } else if let last = components.last {
            return String(last)
        }
        return path
    }

    private func formatTime(_ minutes: Int) -> String {
        let hours = minutes / 60
        let mins = minutes % 60
        if hours > 0 {
            return "\(hours)h \(mins)m"
        }
        return "\(mins)m"
    }
}
