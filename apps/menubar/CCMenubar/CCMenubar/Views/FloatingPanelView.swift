import SwiftUI

struct FloatingPanelView: View {
    var sessionManager: SessionManager
    var onClose: () -> Void

    /// Sessions grouped by parent directory, sorted alphabetically
    private var groupedSessions: [(parent: String, sessions: [Session])] {
        let grouped = Dictionary(grouping: sessionManager.sessions) { $0.parentDirectory }
        return grouped
            .map { (parent: $0.key, sessions: $0.value.sorted { $0.projectName < $1.projectName }) }
            .sorted { $0.parent < $1.parent }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Claude Code Sessions")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                Spacer()
                Button(action: {
                    sessionManager.refresh()
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12))
                }
                .buttonStyle(.borderless)
                .help("Refresh sessions")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider()

            if sessionManager.sessions.isEmpty {
                VStack {
                    Spacer()
                    Text("No active sessions")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(groupedSessions, id: \.parent) { group in
                            VStack(alignment: .leading, spacing: 0) {
                                // Section header
                                Text(group.parent)
                                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal, 10)
                                    .padding(.top, 8)
                                    .padding(.bottom, 6)

                                // Sessions in this group
                                ForEach(group.sessions) { session in
                                    FloatingPanelSessionRow(session: session)
                                }
                                .padding(.bottom, 6)
                            }
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.primary.opacity(0.05))
                            )
                        }
                    }
                    .padding(12)
                }
            }
        }
        .frame(minWidth: 400, minHeight: 200)
    }
}

struct FloatingPanelSessionRow: View {
    let session: Session

    var statusColor: Color {
        switch session.status {
        case .waiting:
            return .green
        case .working:
            return .yellow
        case .discovered:
            return .gray
        case .unknown:
            return .gray
        }
    }

    var statusIcon: String {
        switch session.status {
        case .waiting:
            return "●"
        case .working:
            return "◐"
        case .discovered:
            return "◌"
        case .unknown:
            return "○"
        }
    }

    var body: some View {
        HStack {
            Text(statusIcon)
                .foregroundColor(statusColor)
                .font(.system(size: 12, weight: .bold, design: .monospaced))

            Text(session.projectName)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .lineLimit(1)

            if let branch = session.gitBranch, !branch.isEmpty {
                let displayBranch = branch.count > 24 ? String(branch.prefix(24)) + "…" : branch
                Text("(\(displayBranch))")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(session.timeSinceLastActivity)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }
}
