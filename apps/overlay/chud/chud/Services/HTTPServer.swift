import Foundation
import Network

class HTTPServer {
    private var listener: NWListener?
    private let port: UInt16 = 19222
    var onSessionEvent: ((SessionEvent) -> Void)?

    func start() {
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
        } catch {
            print("[chud] Failed to create listener: \(error)")
            return
        }

        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }

        listener?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("[chud] HTTP server listening on port \(self.port)")
            case .failed(let error):
                print("[chud] HTTP server failed: \(error)")
            default:
                break
            }
        }

        listener?.start(queue: .main)
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .main)

        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, error in
            if let data = data, let request = String(data: data, encoding: .utf8) {
                self?.handleRequest(request, connection: connection)
            }
            connection.cancel()
        }
    }

    private func handleRequest(_ request: String, connection: NWConnection) {
        // Parse HTTP request to extract JSON body
        let lines = request.components(separatedBy: "\r\n")

        // Find the empty line that separates headers from body
        if let emptyLineIndex = lines.firstIndex(of: "") {
            let bodyLines = lines[(emptyLineIndex + 1)...]
            let body = bodyLines.joined(separator: "\r\n")

            if let jsonData = body.data(using: .utf8) {
                do {
                    let event = try JSONDecoder().decode(SessionEvent.self, from: jsonData)
                    DispatchQueue.main.async {
                        self.onSessionEvent?(event)
                    }
                } catch {
                    print("[chud] Failed to decode event: \(error)")
                }
            }
        }

        // Send HTTP 200 response
        let response = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed({ _ in }))
    }
}
