import AuroraKit
import SwiftUI
import XCTest
@testable import Aurora

/// Renders key screens off-screen so a build can be inspected without a display. Output: $AURORA_SNAPSHOT_DIR (default /tmp/aurora-snaps).
@MainActor
final class RenderTests: XCTestCase {
    private func snapshot<V: View>(_ view: V, name: String, size: CGSize = CGSize(width: 1000, height: 640)) throws {
        let dir = ProcessInfo.processInfo.environment["AURORA_SNAPSHOT_DIR"] ?? "/tmp/aurora-snaps"
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        let r = ImageRenderer(content: view.frame(width: size.width, height: size.height).background(Color(nsColor: .windowBackgroundColor)))
        r.scale = 2
        let image = try XCTUnwrap(r.nsImage, "\(name) did not render")
        let rep = try XCTUnwrap(NSBitmapImageRep(data: try XCTUnwrap(image.tiffRepresentation)))
        try XCTUnwrap(rep.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: "\(dir)/\(name).png"))
    }

    func testConnectScreenRenders() throws {
        try snapshot(ConnectView().environment(AppStore(tokens: InMemoryTokenStore())), name: "connect")
    }

    func testStatusPillsAndProductHeaderRender() throws {
        let d = JSONDecoder(); d.keyDecodingStrategy = .convertFromSnakeCase
        let p = try d.decode(Product.self, from: Data(#"{"id":"1","name":"Demo product","website_url":"https://example.com","description":null,"profile_status":"ready","created_at":"2026-10-17"}"#.utf8))
        try snapshot(ProductDetailView(product: p).environment(AppStore(tokens: InMemoryTokenStore("t"))), name: "product")
    }

    func testFeedbackURLIsPrefilled() {
        let url = feedbackURL().absoluteString
        XCTAssertTrue(url.contains("template=poc-feedback.yml"))
        XCTAssertTrue(url.contains("Native%20Mac%20app") || url.contains("Native+Mac+app"))
    }
}
