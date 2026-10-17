import SwiftUI

@main
struct AuroraApp: App {
    @State private var store = AppStore()
    @Environment(\.openURL) private var openURL

    var body: some Scene {
        WindowGroup("Aurora") {
            RootView()
                .environment(store)
                .frame(minWidth: 900, minHeight: 600)
        }
        .commands {
            CommandGroup(replacing: .help) {
                Button("Send Feedback…") { openURL(feedbackURL()) }
                Link("Aurora Documentation", destination: URL(string: "https://zyvorai.github.io/aurora/docs/poc.html")!)
            }
            CommandGroup(after: .sidebar) {
                Button("Reload") { Task { await store.loadProducts() } }.keyboardShortcut("r", modifiers: .command)
            }
        }
        Settings { SettingsView().environment(store) }
    }
}
