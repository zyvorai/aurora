import AuroraKit
import Foundation
import Observation

@MainActor
@Observable
final class AppStore {
    static let defaultServer = "http://localhost:3000"
    private let tokens: any TokenStore
    private let defaults = UserDefaults.standard

    var serverAddress: String { didSet { defaults.set(serverAddress, forKey: "serverAddress") } }
    private(set) var isSignedIn: Bool
    var products: [Product] = []
    var selectedProductId: String?
    var sidebarSelection: SidebarItem? = .products
    var banner: String?
    var isBusy = false

    init(tokens: any TokenStore = KeychainTokenStore()) {
        self.tokens = tokens
        self.serverAddress = UserDefaults.standard.string(forKey: "serverAddress") ?? Self.defaultServer
        self.isSignedIn = tokens.load() != nil
    }

    /// nil when the typed address is unusable.
    var client: APIClient? {
        guard let base = apiBaseURL(from: serverAddress) else { return nil }
        let store = tokens
        return APIClient(baseURL: base, token: { store.load() })
    }

    func signIn(email: String, password: String) async {
        guard let client else { banner = APIError.invalidServerURL.localizedDescription; return }
        isBusy = true; defer { isBusy = false }
        do {
            let t = try await client.login(email: email, password: password)
            tokens.save(t.accessToken)
            isSignedIn = true
            banner = nil
            await loadProducts()
        } catch { banner = error.localizedDescription }
    }

    func signOut() {
        tokens.clear()
        isSignedIn = false
        products = []
        selectedProductId = nil
    }

    func loadProducts() async {
        guard let client else { return }
        do {
            products = try await client.products()
            if selectedProductId == nil || !products.contains(where: { $0.id == selectedProductId }) {
                selectedProductId = products.first?.id
            }
        } catch { handle(error) }
    }

    func createProduct(name: String, website: String, description: String) async -> Bool {
        guard let client else { return false }
        do {
            let p = try await client.createProduct(
                name: name,
                websiteUrl: website.isEmpty ? nil : website,
                description: description.isEmpty ? nil : description
            )
            products.insert(p, at: 0)
            selectedProductId = p.id
            return true
        } catch { handle(error); return false }
    }

    /// Central error handling: an expired session sends the user back to sign-in.
    func handle(_ error: Error) {
        if let api = error as? APIError, api == .unauthorized { signOut() }
        banner = error.localizedDescription
    }

    var selectedProduct: Product? { products.first { $0.id == selectedProductId } }
}

enum SidebarItem: Hashable { case products, agents, audit }

/// Feedback link pre-filled with the OS and app version (no secrets).
func feedbackURL() -> URL {
    let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "dev"
    var c = URLComponents(string: "https://github.com/zyvorai/aurora/issues/new")!
    c.queryItems = [
        .init(name: "template", value: "poc-feedback.yml"),
        .init(name: "title", value: "PoC feedback (Mac app \(v))"),
        .init(name: "os", value: "Native Mac app"),
    ]
    return c.url!
}
