//
//  CCMenubarApp.swift
//  CCMenubar
//
//  Created by JP on 1/12/26.
//

import SwiftUI

/// Coordinates the session manager and HTTP server lifecycle.
/// Using a class allows us to wire up callbacks properly.
@MainActor
final class AppCoordinator {
    let sessionManager = SessionManager()
    let httpServer = HTTPServer()

    init() {
        httpServer.onSessionEvent = { [weak self] event in
            Task { @MainActor in
                self?.sessionManager.handleEvent(event)
            }
        }
        httpServer.start()
    }
}

@main
struct CCMenubarApp: App {
    @State private var coordinator = AppCoordinator()

    var body: some Scene {
        MenuBarExtra {
            MenuBarView(sessionManager: coordinator.sessionManager)
        } label: {
            Image(systemName: "terminal")
        }
        .menuBarExtraStyle(.window)
    }
}
