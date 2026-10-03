// Renders the app icon (TaDo/Assets.xcassets/AppIcon.appiconset/icon-1024.png):
// the web Logomark — three frosted circles with a purple core — on the app's
// purple backdrop. Run: swift scripts/make-icon.swift && sips -z 1024 1024 <that png>
// (AppKit renders at the Mac's 2x scale, so the resize brings it back to 1024).
import AppKit

let size: CGFloat = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let ctx = NSGraphicsContext.current!.cgContext
let space = CGColorSpace(name: CGColorSpace.sRGB)!

// Background: lavender-to-purple diagonal, like the backdrop's blobs over the light tint.
let gradient = CGGradient(colorsSpace: space, colors: [
    CGColor(srgbRed: 0.62, green: 0.53, blue: 0.93, alpha: 1),
    CGColor(srgbRed: 0.42, green: 0.33, blue: 0.78, alpha: 1),
] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: size), end: CGPoint(x: size, y: 0), options: [])

// Logomark circles, from Logomark.tsx's 56-unit viewBox (y flipped for CoreGraphics).
let scale = size / 56 * 0.78
let offset = (size - 56 * scale) / 2
func circle(_ r: CGFloat, _ x: CGFloat, _ y: CGFloat, _ color: CGColor) {
    ctx.setFillColor(color)
    let cx = offset + x * scale, cy = size - (offset + y * scale)
    ctx.fillEllipse(in: CGRect(x: cx - r * scale, y: cy - r * scale, width: 2 * r * scale, height: 2 * r * scale))
}
circle(16, 22, 25, CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.55))
circle(11, 35, 19, CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.4))
circle(9, 29, 35, CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.3))
circle(5.5, 25, 27, CGColor(srgbRed: 0.483, green: 0.396, blue: 0.819, alpha: 1))

image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: "TaDo/Assets.xcassets/AppIcon.appiconset/icon-1024.png"))
print("Wrote icon")
