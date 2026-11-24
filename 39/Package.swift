// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MakeTen",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "MakeTen", path: "Sources/MakeTen")
    ]
)
