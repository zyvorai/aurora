import Foundation
import Testing
@testable import AuroraKit

final class MockProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> (Int, Data))?
    nonisolated(unsafe) static var lastRequest: URLRequest?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var req = request
        if req.httpBody == nil, let s = req.httpBodyStream {
            s.open(); var d = Data(); let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
            while s.hasBytesAvailable { let n = s.read(buf, maxLength: 4096); if n <= 0 { break }; d.append(buf, count: n) }
            buf.deallocate(); req.httpBody = d
        }
        MockProtocol.lastRequest = req
        let (status, data) = MockProtocol.handler?(req) ?? (500, Data())
        let resp = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private func makeClient(token: String? = "tok") -> APIClient {
    let cfg = URLSessionConfiguration.ephemeral
    cfg.protocolClasses = [MockProtocol.self]
    return APIClient(baseURL: URL(string: "http://localhost:3000/api/v1")!, session: URLSession(configuration: cfg), token: { token })
}

@Suite(.serialized) struct AuroraKitTests {
    @Test func normalisesServerAddresses() {
        #expect(apiBaseURL(from: "localhost:3000")?.absoluteString == "http://localhost:3000/api/v1")
        #expect(apiBaseURL(from: "http://127.0.0.1:8000/")?.absoluteString == "http://127.0.0.1:8000/api/v1")
        #expect(apiBaseURL(from: "aurora.example.com")?.absoluteString == "https://aurora.example.com/api/v1")
        #expect(apiBaseURL(from: "https://aurora.example.com/api/v1/")?.absoluteString == "https://aurora.example.com/api/v1")
        #expect(apiBaseURL(from: "mac-mini.local:3000")?.absoluteString == "http://mac-mini.local:3000/api/v1")
        #expect(apiBaseURL(from: "") == nil)
        #expect(apiBaseURL(from: "ftp://x") == nil)
    }

    @Test func loginDecodesSnakeCaseAndSendsCredentials() async throws {
        MockProtocol.handler = { _ in (200, Data(#"{"access_token":"abc","token_type":"bearer","tenant_id":"t1","user_id":"u1","role":"admin"}"#.utf8)) }
        let t = try await makeClient(token: nil).login(email: "a@b.co", password: "pw")
        #expect(t.accessToken == "abc" && t.role == "admin")
        let body = try #require(MockProtocol.lastRequest?.httpBody)
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(json == ["email": "a@b.co", "password": "pw"])
        #expect(MockProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization") == nil)
    }

    @Test func sendsBearerTokenAndDecodesProducts() async throws {
        MockProtocol.handler = { _ in (200, Data(#"[{"id":"1","name":"Demo","website_url":"https://example.com","description":null,"profile_status":"ready","created_at":"2026-10-17"}]"#.utf8)) }
        let p = try await makeClient().products()
        #expect(p.first?.websiteUrl == "https://example.com" && p.first?.description == nil)
        #expect(MockProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization") == "Bearer tok")
        #expect(MockProtocol.lastRequest?.url?.path == "/api/v1/products")
    }

    @Test func mapsUnauthorizedAndServerDetail() async {
        MockProtocol.handler = { _ in (401, Data()) }
        await #expect(throws: APIError.unauthorized) { _ = try await makeClient().products() }
        MockProtocol.handler = { _ in (400, Data(#"{"detail":"Product profile is empty."}"#.utf8)) }
        await #expect(throws: APIError.server(status: 400, detail: "Product profile is empty.")) { _ = try await makeClient().products() }
    }

    @Test func seoKeywordsKeepEstimateFlag() async throws {
        MockProtocol.handler = { _ in (200, Data(#"{"provider":"estimate","measured":false,"keywords":[{"keyword":"demo product","intent":"informational","source":"estimate","volume":null,"difficulty":null,"clicks":null,"impressions":null,"position":null}]}"#.utf8)) }
        let r = try await makeClient().seoKeywords(productId: "1", seed: "demo")
        #expect(!r.measured && r.keywords[0].isEstimate)
        #expect(MockProtocol.lastRequest?.url?.path == "/api/v1/products/1/seo/keywords")
    }

    @Test func publishSendsSnakeCaseBody() async throws {
        MockProtocol.handler = { _ in (200, Data(#"{"channel_post_id":"p1","status":"published","idempotency_key":"k"}"#.utf8)) }
        let r = try await makeClient().publish(artifactId: "a1", channel: "wordpress")
        #expect(r.status == "published")
        let body = try #require(MockProtocol.lastRequest?.httpBody)
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["artifact_id"] as? String == "a1" && json["channel"] as? String == "wordpress")
    }

    @Test func tokenStoreRoundTrip() {
        let s = InMemoryTokenStore()
        #expect(s.load() == nil)
        s.save("x"); #expect(s.load() == "x")
        s.clear(); #expect(s.load() == nil)
    }
}
