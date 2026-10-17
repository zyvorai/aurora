import AuroraKit
import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        Group {
            if store.isSignedIn { MainView() } else { ConnectView() }
        }
        .task { if store.isSignedIn { await store.loadProducts() } }
    }
}

struct MainView: View {
    @Environment(AppStore.self) private var store
    @State private var showNewProduct = false

    var body: some View {
        @Bindable var store = store
        NavigationSplitView {
            List(selection: $store.sidebarSelection) {
                Section("Workspace") {
                    Label("Products", systemImage: "shippingbox").tag(SidebarItem.products)
                }
                Section("Platform") {
                    Label("Agents", systemImage: "cpu").tag(SidebarItem.agents)
                    Label("Audit log", systemImage: "list.bullet.rectangle").tag(SidebarItem.audit)
                }
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 210)
        } detail: {
            switch store.sidebarSelection ?? .products {
            case .products: ProductsView(showNewProduct: $showNewProduct)
            case .agents: AgentsView()
            case .audit: AuditView()
            }
        }
        .sheet(isPresented: $showNewProduct) { NewProductSheet() }
        .overlay(alignment: .bottom) { BannerView() }
    }
}

struct BannerView: View {
    @Environment(AppStore.self) private var store
    var body: some View {
        if let message = store.banner {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                Text(message).font(.callout).lineLimit(3)
                Spacer()
                Button("Dismiss") { store.banner = nil }.buttonStyle(.borderless)
            }
            .padding(12)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator))
            .padding()
            .frame(maxWidth: 640)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Error: \(message)")
        }
    }
}

struct ConnectView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @State private var step = 0

    var body: some View {
        @Bindable var store = store
        VStack(spacing: 22) {
            Image(systemName: "sparkles.rectangle.stack").font(.system(size: 44)).foregroundStyle(Color.accentColor)
            Text("Aurora").font(.system(size: 34, weight: .semibold))
            Text("Sign in to your Aurora server").foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 10) {
                LabeledContent("Server") {
                    TextField("http://localhost:3000", text: $store.serverAddress).textFieldStyle(.roundedBorder)
                }
                TextField("Email", text: $email).textFieldStyle(.roundedBorder).textContentType(.username)
                SecureField("Password", text: $password).textFieldStyle(.roundedBorder).textContentType(.password)
                    .onSubmit(submit)
            }
            .frame(width: 360)
            if let message = store.banner {
                Text(message).font(.callout).foregroundStyle(.red).frame(width: 360).multilineTextAlignment(.center)
            }
            HStack {
                Button(action: submit) {
                    if store.isBusy { ProgressView().controlSize(.small) } else { Text("Sign in") }
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent).controlSize(.large)
                .disabled(email.isEmpty || password.isEmpty || store.isBusy)
            }
            Text("Trying the PoC? The installer prints the address and a demo login.")
                .font(.footnote).foregroundStyle(.secondary)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        Task { await store.signIn(email: email, password: password) }
    }
}

struct NewProductSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var website = ""
    @State private var details = ""
    @State private var busy = false

    var body: some View {
        Form {
            TextField("Name", text: $name)
            TextField("Website or docs URL", text: $website)
            TextField("Description (optional)", text: $details, axis: .vertical).lineLimit(2...4)
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .padding(.bottom, 8)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Create") {
                    busy = true
                    Task {
                        if await store.createProduct(name: name, website: website, description: details) { dismiss() }
                        busy = false
                    }
                }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
            }
        }
    }
}
