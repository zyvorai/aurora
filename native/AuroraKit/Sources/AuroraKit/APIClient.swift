import Foundation

public enum APIError: Error, LocalizedError, Sendable, Equatable {
    case invalidServerURL
    case unauthorized
    case server(status: Int, detail: String)
    case transport(String)
    case decoding(String)

    public var errorDescription: String? {
        switch self {
        case .invalidServerURL: return "That doesn't look like a server address."
        case .unauthorized: return "Your session expired or the credentials are wrong. Sign in again."
        case .server(let status, let detail): return "Server error \(status): \(detail)"
        case .transport(let m): return "Can't reach the server: \(m)"
        case .decoding(let m): return "Unexpected response from the server (\(m))."
        }
    }
}

/// Normalises what a user typed ("localhost:3000", "https://aurora.example.com/") into the API base URL.
/// The web app proxies `/api/v1` to the API, so either the web or the API address works.
public func apiBaseURL(from input: String) -> URL? {
    var text = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return nil }
    if !text.contains("://") {
        let hostPort = text.split(separator: "/").first.map(String.init) ?? text
        let host = hostPort.hasPrefix("[") ? hostPort : (hostPort.split(separator: ":").first.map(String.init) ?? hostPort)
        let local = host == "localhost" || host.hasPrefix("127.") || host.hasPrefix("[::1]") || host.hasSuffix(".local")
        text = (local ? "http://" : "https://") + text
    }
    while text.hasSuffix("/") { text.removeLast() }
    if text.hasSuffix("/api/v1") { text.removeLast("/api/v1".count) }
    guard var comps = URLComponents(string: text), let host = comps.host, !host.isEmpty,
          comps.scheme == "http" || comps.scheme == "https" else { return nil }
    comps.path = comps.path + "/api/v1"
    return comps.url
}

public final class APIClient: Sendable {
    public let baseURL: URL
    private let session: URLSession
    private let tokenProvider: @Sendable () -> String?
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    public init(baseURL: URL, session: URLSession = .shared, token: @escaping @Sendable () -> String?) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = token
    }

    // MARK: core

    private func request<T: Decodable & Sendable>(
        _ method: String, _ path: String, body: (any Encodable & Sendable)? = nil, query: [String: String] = [:], timeout: TimeInterval = 60
    ) async throws -> T {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        if !query.isEmpty { comps?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        guard let url = comps?.url else { throw APIError.invalidServerURL }
        var req = URLRequest(url: url, timeoutInterval: timeout)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = tokenProvider() { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }
        let data: Data, response: URLResponse
        do { (data, response) = try await session.data(for: req) }
        catch { throw APIError.transport(error.localizedDescription) }
        guard let http = response as? HTTPURLResponse else { throw APIError.transport("no HTTP response") }
        switch http.statusCode {
        case 200..<300: break
        case 401: throw APIError.unauthorized
        default: throw APIError.server(status: http.statusCode, detail: Self.detail(from: data))
        }
        do { return try Self.decoder.decode(T.self, from: data) }
        catch { throw APIError.decoding(String(describing: error).prefix(160).description) }
    }

    static func detail(from data: Data) -> String {
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let d = obj["detail"] as? String { return d }
            if let d = obj["detail"] { return String(describing: d).prefix(200).description }
            if let m = obj["message"] as? String { return m }
        }
        return String(data: data.prefix(200), encoding: .utf8) ?? "no details"
    }

    // MARK: endpoints

    public func login(email: String, password: String) async throws -> TokenResponse {
        try await request("POST", "auth/login", body: Credentials(email: email, password: password))
    }
    public func products() async throws -> [Product] { try await request("GET", "products") }
    public func createProduct(name: String, websiteUrl: String?, description: String?) async throws -> Product {
        try await request("POST", "products", body: NewProduct(name: name, websiteUrl: websiteUrl, description: description))
    }
    public func artifacts(productId: String) async throws -> [Artifact] { try await request("GET", "products/\(productId)/artifacts") }
    public func workflowRuns(productId: String, limit: Int = 20) async throws -> [WorkflowRun] {
        try await request("GET", "products/\(productId)/workflow-runs", query: ["limit": String(limit)])
    }
    public func agents() async throws -> [AgentEntry] { try await request("GET", "agents/registry") }
    public func auditLog() async throws -> [AuditEntry] { try await request("GET", "audit") }

    public func approve(artifactId: String, approved: Bool, comment: String? = nil) async throws -> ApprovalResponse {
        try await request("POST", "artifacts/\(artifactId)/approve", body: Approval(status: approved ? "approved" : "rejected", comment: comment))
    }
    public func publish(artifactId: String, channel: String, recipient: String? = nil) async throws -> PublishResponse {
        try await request("POST", "artifacts/\(artifactId)/publish", body: Publish(artifactId: artifactId, channel: channel, recipient: recipient))
    }

    public func seoProviders() async throws -> SeoProviders { try await request("GET", "seo/providers") }
    public func seoAudit(productId: String, url: String) async throws -> SeoAudit {
        try await request("POST", "products/\(productId)/seo/audit", body: UrlBody(url: url), timeout: 90)
    }
    public func seoKeywords(productId: String, seed: String, provider: String? = nil) async throws -> SeoKeywordResult {
        try await request("POST", "products/\(productId)/seo/keywords", body: KeywordBody(seed: seed, limit: 25, provider: provider), timeout: 180)
    }
    public func seoScore(artifactId: String, keyword: String) async throws -> SeoScore {
        try await request("POST", "artifacts/\(artifactId)/seo/score", body: KeywordOnly(keyword: keyword))
    }
}

// MARK: request bodies (snake_case on the wire)

private struct Credentials: Encodable, Sendable { let email: String; let password: String }
private struct NewProduct: Encodable, Sendable {
    let name: String; let websiteUrl: String?; let description: String?
    enum CodingKeys: String, CodingKey { case name, websiteUrl = "website_url", description }
}
private struct Approval: Encodable, Sendable { let status: String; let comment: String? }
private struct Publish: Encodable, Sendable {
    let artifactId: String; let channel: String; let recipient: String?
    enum CodingKeys: String, CodingKey { case artifactId = "artifact_id", channel, recipient }
}
private struct UrlBody: Encodable, Sendable { let url: String }
private struct KeywordBody: Encodable, Sendable { let seed: String; let limit: Int; let provider: String? }
private struct KeywordOnly: Encodable, Sendable { let keyword: String }

private struct AnyEncodable: Encodable {
    let value: any Encodable
    init(_ value: any Encodable) { self.value = value }
    func encode(to encoder: any Encoder) throws { try value.encode(to: encoder) }
}
