#!/usr/bin/env swift
// Renders the Zyvor Z tile (same artwork as apps/web/public/zyvor-mark.svg) into an .appiconset.
// Usage: swift scripts/make-app-icon.swift native/App/Assets.xcassets/AppIcon.appiconset
import AppKit

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon.appiconset"
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)

func render(_ px: Int) -> Data {
    let s = CGFloat(px)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4,
                               hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    let k = s / 64                      // SVG viewBox is 64x64
    ctx.scaleBy(x: k, y: k); ctx.translateBy(x: 0, y: 64); ctx.scaleBy(x: 1, y: -1)   // y down like SVG
    let inset: CGFloat = 4              // macOS icon grid leaves a margin around the tile
    let rect = CGRect(x: inset, y: inset, width: 64 - 2 * inset, height: 64 - 2 * inset)
    let path = CGPath(roundedRect: rect, cornerWidth: 13, cornerHeight: 13, transform: nil)
    ctx.saveGState(); ctx.addPath(path); ctx.clip()
    let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                          colors: [NSColor(srgbRed: 1.0, green: 0.353, blue: 0.082, alpha: 1).cgColor,
                                   NSColor(srgbRed: 0.8, green: 0.259, blue: 0.039, alpha: 1).cgColor] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(grad, start: CGPoint(x: 8, y: 8), end: CGPoint(x: 56, y: 56), options: [])
    ctx.restoreGState()
    ctx.setStrokeColor(NSColor.white.cgColor); ctx.setLineWidth(7.4); ctx.setLineCap(.round); ctx.setLineJoin(.round)
    ctx.move(to: CGPoint(x: 19.5, y: 21)); ctx.addLine(to: CGPoint(x: 44.5, y: 21)); ctx.addLine(to: CGPoint(x: 19.5, y: 43)); ctx.addLine(to: CGPoint(x: 44.5, y: 43))
    ctx.strokePath()
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

var images: [[String: String]] = []
for (pt, scale) in [(16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2), (256, 1), (256, 2), (512, 1), (512, 2)] {
    let name = "icon_\(pt)x\(pt)@\(scale)x.png"
    try! render(pt * scale).write(to: URL(fileURLWithPath: "\(out)/\(name)"))
    images.append(["idiom": "mac", "size": "\(pt)x\(pt)", "scale": "\(scale)x", "filename": name])
}
let contents: [String: Any] = ["images": images, "info": ["version": 1, "author": "xcode"]]
try! JSONSerialization.data(withJSONObject: contents, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: "\(out)/Contents.json"))
print("wrote \(images.count) icons to \(out)")
