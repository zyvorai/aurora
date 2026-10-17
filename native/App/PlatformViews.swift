import AuroraKit
import SwiftUI

struct AgentsView: View {
    @Environment(AppStore.self) private var store
    @State private var agents: [AgentEntry] = []
    @State private var query = ""

    var body: some View {
        let shown = agents.filter { query.isEmpty || ($0.displayName + $0.description).localizedCaseInsensitiveContains(query) }
        List(shown) { a in
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.displayName).font(.headline)
                    Text(a.description).font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                Text(a.computeTier).font(.caption).foregroundStyle(.secondary)
                StatusPill(text: a.implemented ? "live" : "planned")
            }
            .padding(.vertical, 2)
        }
        .searchable(text: $query, prompt: "Search agents")
        .navigationTitle("Agents")
        .task { if let c = store.client { do { agents = try await c.agents() } catch { store.handle(error) } } }
    }
}

struct AuditView: View {
    @Environment(AppStore.self) private var store
    @State private var entries: [AuditEntry] = []
    @State private var query = ""

    var body: some View {
        let shown = entries.sorted { $0.createdAt > $1.createdAt }.filter {
            query.isEmpty || ($0.action + $0.resourceType + ($0.resourceId ?? "")).localizedCaseInsensitiveContains(query)
        }
        Table(shown) {
            TableColumn("When", value: \.createdAt).width(min: 150, ideal: 190)
            TableColumn("Action", value: \.action)
            TableColumn("Resource") { Text($0.resourceType + ($0.resourceId.map { " · \($0.prefix(8))" } ?? "")) }
        }
        .overlay { if entries.isEmpty { ContentUnavailableView("No audit entries yet", systemImage: "list.bullet.rectangle", description: Text("Actions appear here as your team works.")) } }
        .searchable(text: $query, prompt: "Search")
        .navigationTitle("Audit log")
        .task { if let c = store.client { do { entries = try await c.auditLog() } catch { store.handle(error) } } }
    }
}

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL

    var body: some View {
        @Bindable var store = store
        Form {
            TextField("Server", text: $store.serverAddress, prompt: Text(AppStore.defaultServer))
            LabeledContent("Account") {
                if store.isSignedIn { Button("Sign out", role: .destructive) { store.signOut() } } else { Text("Not signed in").foregroundStyle(.secondary) }
            }
            LabeledContent("Version") {
                Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "dev").foregroundStyle(.secondary)
            }
            Button("Send feedback…") { openURL(feedbackURL()) }
        }
        .formStyle(.grouped).frame(width: 460).padding()
    }
}
