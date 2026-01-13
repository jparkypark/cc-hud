import Foundation

struct SessionEvent: Codable {
    let event: String  // "start", "update", "end"
    let cwd: String
    let gitBranch: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case event
        case cwd
        case gitBranch = "git_branch"
        case status
    }
}
