import Foundation

struct SessionEvent: Codable {
    let event: String  // "start", "update", "end"
    let sessionId: String
    let cwd: String
    let gitBranch: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case event
        case sessionId = "session_id"
        case cwd
        case gitBranch = "git_branch"
        case status
    }
}
