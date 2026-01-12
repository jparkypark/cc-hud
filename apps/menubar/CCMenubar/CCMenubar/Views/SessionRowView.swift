import SwiftUI

struct SessionRowView: View {
    let session: Session

    var statusColor: Color {
        switch session.status {
        case .waiting:
            return .green
        case .working:
            return .yellow
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
                .frame(width: 120, alignment: .leading)
                .lineLimit(1)

            Text(session.abbreviatedPath)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.secondary)
                .lineLimit(1)

            if let branch = session.gitBranch, !branch.isEmpty {
                Text("(\(branch))")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(session.timeSinceLastActivity)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }
}
