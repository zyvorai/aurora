import AuroraKit
import SwiftUI

struct ProductsView: View {
    @Environment(AppStore.self) private var store
    @Binding var showNewProduct: Bool

    var body: some View {
        @Bindable var store = store
        HSplitView {
            List(selection: $store.selectedProductId) {
                ForEach(store.products) { p in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.name).font(.headline)
                        Text(p.websiteUrl ?? "No website").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .tag(p.id)
                    .padding(.vertical, 2)
                }
            }
            .frame(minWidth: 220, idealWidth: 250, maxWidth: 320)
            .overlay {
                if store.products.isEmpty {
                    ContentUnavailableView {
                        Label("No products yet", systemImage: "shippingbox")
                    } description: {
                        Text("Paste a website or docs URL and Aurora builds a product profile from it.")
                    } actions: {
                        Button("Create product") { showNewProduct = true }.buttonStyle(.borderedProminent)
                    }
                }
            }
            Group {
                if let product = store.selectedProduct { ProductDetailView(product: product).id(product.id) }
                else { Text("Select a product").foregroundStyle(.secondary).frame(maxWidth: .infinity, maxHeight: .infinity) }
            }
            .frame(minWidth: 520)
        }
        .toolbar {
            ToolbarItem { Button { showNewProduct = true } label: { Label("New product", systemImage: "plus") } }
            ToolbarItem { Button { Task { await store.loadProducts() } } label: { Label("Reload", systemImage: "arrow.clockwise") } }
        }
        .navigationTitle("Products")
    }
}

enum ProductTab: String, CaseIterable, Identifiable {
    case workspace = "Workspace", seo = "SEO", artifacts = "Content"
    var id: String { rawValue }
}

struct ProductDetailView: View {
    let product: Product
    @State private var tab: ProductTab = .workspace

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text(product.name).font(.title.weight(.semibold))
                HStack {
                    if let w = product.websiteUrl, let url = URL(string: w) { Link(w, destination: url).font(.callout) }
                    Spacer()
                    StatusPill(text: product.profileStatus)
                }
            }
            .padding([.horizontal, .top], 20)
            Picker("Section", selection: $tab) {
                ForEach(ProductTab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented).labelsHidden().padding(20)
            Divider()
            switch tab {
            case .workspace: WorkspaceView(product: product)
            case .seo: SeoView(product: product)
            case .artifacts: ArtifactsView(product: product)
            }
        }
    }
}

struct StatusPill: View {
    let text: String
    var body: some View {
        let tone: Color = switch text.lowercased() {
        case "ready", "completed", "approved", "published", "success": .green
        case "failed", "rejected", "error": .red
        case "running", "queued", "pending", "draft", "building": .orange
        default: .secondary
        }
        Text(text.capitalized)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(tone.opacity(0.15), in: Capsule())
            .foregroundStyle(tone)
    }
}

struct WorkspaceView: View {
    @Environment(AppStore.self) private var store
    let product: Product
    @State private var runs: [WorkflowRun] = []
    @State private var loaded = false

    var body: some View {
        List {
            Section("Recent runs") {
                if loaded && runs.isEmpty {
                    Text("Nothing has run yet. Start ingest and strategy from the web console; progress shows up here.")
                        .foregroundStyle(.secondary)
                }
                ForEach(runs) { run in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text(run.workflowName).font(.headline); Spacer(); StatusPill(text: run.status) }
                        if run.isActive, !run.steps.isEmpty {
                            let done = run.steps.filter { $0.status == "completed" || $0.status == "done" }.count
                            ProgressView(value: Double(done), total: Double(run.steps.count))
                        }
                        if let e = run.errorMessage, run.status == "failed" { Text(e).font(.caption).foregroundStyle(.red).lineLimit(2) }
                    }
                    .padding(.vertical, 3)
                }
            }
        }
        .task(id: product.id) {
            // Poll while this tab is visible; the task is cancelled when the view goes away.
            while !Task.isCancelled {
                if let c = store.client {
                    do { runs = try await c.workflowRuns(productId: product.id); loaded = true }
                    catch { store.handle(error) }
                }
                try? await Task.sleep(for: .seconds(runs.contains { $0.isActive } ? 3 : 10))
            }
        }
    }
}
