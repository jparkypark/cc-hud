import SwiftUI

struct MenuBarView: View {
    var sessionManager: SessionManager
    var onShowSessions: () -> Void

    private var sessionCountText: String {
        let count = sessionManager.sessions.count
        if count == 0 {
            return "No active sessions"
        } else if count == 1 {
            return "1 active session"
        } else {
            return "\(count) active sessions"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Status
            Text(sessionCountText)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)

            Divider()

            // Show Sessions
            Button(action: onShowSessions) {
                HStack {
                    Image(systemName: "rectangle.stack")
                    Text("Show Sessions")
                    Spacer()
                    Text("⌘S")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)

            // Refresh
            Button(action: {
                sessionManager.refresh()
            }) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Refresh")
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)

            Divider()

            // Quit
            Button(action: {
                NSApplication.shared.terminate(nil)
            }) {
                Text("Quit")
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .frame(width: 200)
        .padding(.vertical, 4)
    }
}
