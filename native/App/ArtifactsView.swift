import AuroraKit
import SwiftUI

struct ArtifactsView: View {
    @Environment(AppStore.self) private var store
    let product: Product
    @State private var items: [Artifact] = []
    @State private var loaded = false
    @State private var publishing: Artifact?
    @State private var confirm: (Artifact, Bool)?

    var body: some View {
        List(items) { a in
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.title ?? "Untitled").font(.headline).lineLimit(1)
                    Text("\(a.type) · \(a.channel ?? "no channel")").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                StatusPill(text: a.status)
                if a.status == "draft" || a.status == "pending" {
                    Button("Approve") { confirm = (a, true) }.buttonStyle(.bordered)
                    Button("Reject") { confirm = (a, false) }.buttonStyle(.borderless).foregroundStyle(.red)
                }
                if a.status == "approved" { Button("Publish…") { publishing = a }.buttonStyle(.borderedProminent) }
            }
            .padding(.vertical, 3)
        }
        .overlay {
            if loaded && items.isEmpty {
                ContentUnavailableView("No content yet", systemImage: "doc.text",
                    description: Text("Strategy, content and outreach drafts appear here for review. Nothing is published until you approve it."))
            }
        }
        .task(id: product.id) { await reload() }
        .toolbar { ToolbarItem { Button { Task { await reload() } } label: { Label("Reload", systemImage: "arrow.clockwise") } } }
        .sheet(item: $publishing) { a in PublishSheet(artifact: a) { await reload() } }
        .confirmationDialog(confirm.map { $0.1 ? "Approve “\($0.0.title ?? "this item")”?" : "Reject “\($0.0.title ?? "this item")”?" } ?? "",
                            isPresented: Binding(get: { confirm != nil }, set: { if !$0 { confirm = nil } }), titleVisibility: .visible) {
            Button(confirm?.1 == true ? "Approve" : "Reject", role: confirm?.1 == true ? nil : .destructive) {
                if let (a, ok) = confirm { Task { await decide(a, ok) } }
            }
        } message: { Text("Approval is tied to this exact content. If it changes, it needs approval again.") }
    }

    private func reload() async {
        guard let c = store.client else { return }
        do { items = try await c.artifacts(productId: product.id); loaded = true } catch { store.handle(error) }
    }

    private func decide(_ a: Artifact, _ approved: Bool) async {
        guard let c = store.client else { return }
        do { _ = try await c.approve(artifactId: a.id, approved: approved); await reload() } catch { store.handle(error) }
    }
}

struct PublishSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let artifact: Artifact
    let onDone: () async -> Void
    @State private var channel = "wordpress"
    @State private var recipient = ""
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        Form {
            Picker("Channel", selection: $channel) { ForEach(publishChannels, id: \.self) { Text($0).tag($0) } }
            if channel == "email" || channel == "newsletter" { TextField("Recipient", text: $recipient) }
            if let message { Text(message).font(.callout).foregroundStyle(.secondary) }
        }
        .formStyle(.grouped).frame(width: 420)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Publish") { publish() }.disabled(busy)
            }
        }
    }

    private func publish() {
        guard let c = store.client else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                let r = try await c.publish(artifactId: artifact.id, channel: channel, recipient: recipient.isEmpty ? nil : recipient)
                message = r.status == "not_configured" ? "\(channel) isn't configured on the server yet, so nothing was sent." : "Status: \(r.status)"
                await onDone()
            } catch { store.handle(error) }
        }
    }
}
