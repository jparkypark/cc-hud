import SwiftUI

struct MenuBarView: View {
    var sessionManager: SessionManager

    /// Sessions grouped by parent directory, sorted alphabetically
    private var groupedSessions: [(parent: String, sessions: [Session])] {
        let grouped = Dictionary(grouping: sessionManager.sessions) { $0.parentDirectory }
        return grouped
            .map { (parent: $0.key, sessions: $0.value.sorted { $0.projectName < $1.projectName }) }
            .sorted { $0.parent < $1.parent }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if sessionManager.sessions.isEmpty {
                Text("No active sessions")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding()
            } else {
                ForEach(groupedSessions, id: \.parent) { group in
                    // Section header
                    Text(group.parent)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .padding(.bottom, 4)

                    // Sessions in this group
                    ForEach(group.sessions) { session in
                        SessionRowView(session: session)
                    }
                }
            }

            Divider()
                .padding(.vertical, 4)

            Button(action: {
                sessionManager.refresh()
            }) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Refresh")
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)

            Divider()
                .padding(.vertical, 4)

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
        .frame(width: 450)
        .padding(.vertical, 8)
    }
}
