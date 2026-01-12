import SwiftUI

struct MenuBarView: View {
    var sessionManager: SessionManager

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if sessionManager.sessions.isEmpty {
                Text("No active sessions")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding()
            } else {
                ForEach(sessionManager.sessions) { session in
                    SessionRowView(session: session)
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
