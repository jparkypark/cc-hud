//
//  chudApp.swift
//  chud
//
//  Created by JP on 1/12/26.
//

import SwiftUI

/// Shared app state - singleton to ensure single instance across app delegate and SwiftUI
@MainActor
final class AppState {
    static let shared = AppState()

    let sessionManager = SessionManager()
    let httpServer = HTTPServer()
    let panelController = FloatingPanelController()
    private var hasLaunched = false

    private init() {
        httpServer.onSessionEvent = { [weak self] event in
            Task { @MainActor in
                self?.sessionManager.handleEvent(event)
            }
        }
        httpServer.start()
    }

    func showFloatingPanel() {
        let panelView = FloatingPanelView(sessionManager: sessionManager) {
            self.panelController.hidePanel()
        }
        panelController.showPanel(with: panelView)
    }

    func handleActivation() {
        // Skip first activation (initial launch)
        if !hasLaunched {
            hasLaunched = true
            return
        }
        showFloatingPanel()
    }
}

/// App delegate to handle activation from Spotlight/Raycast
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidBecomeActive(_ notification: Notification) {
        Task { @MainActor in
            AppState.shared.handleActivation()
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        Task { @MainActor in
            AppState.shared.showFloatingPanel()
        }
        return false
    }
}

@main
struct chudApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        MenuBarExtra {
            MenuBarView(
                sessionManager: AppState.shared.sessionManager,
                onShowSessions: {
                    AppState.shared.showFloatingPanel()
                }
            )
        } label: {
            Image(systemName: "waveform")
        }
        .menuBarExtraStyle(.window)
    }
}
