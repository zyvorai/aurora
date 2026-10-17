// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AuroraKit",
    platforms: [.macOS(.v14)],
    products: [.library(name: "AuroraKit", targets: ["AuroraKit"])],
    targets: [
        .target(name: "AuroraKit"),
        .testTarget(name: "AuroraKitTests", dependencies: ["AuroraKit"]),
    ]
)
