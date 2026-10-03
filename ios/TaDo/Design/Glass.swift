import SwiftUI

/// The web app's frosted card: translucent fill over a blur, hairline white border, soft shadow.
struct GlassCard: ViewModifier {
    var cornerRadius: CGFloat = 20
    var strong = false

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .background {
                shape.fill(.ultraThinMaterial)
                shape.fill(strong ? Theme.glassFillStrong : Theme.glassFill)
            }
            .overlay { shape.strokeBorder(Theme.glassBorder, lineWidth: 1) }
            .shadow(color: Theme.shadow, radius: 15, y: 8)
    }
}

extension View {
    func glassCard(cornerRadius: CGFloat = 20, strong: Bool = false) -> some View {
        modifier(GlassCard(cornerRadius: cornerRadius, strong: strong))
    }
}

/// App background: flat tint plus three blurred purple blobs (GlassBackdrop.tsx);
/// in dark mode a purple radial glow from the top-left, like the web's --app-bg-image.
struct GlassBackdrop: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            ZStack {
                Theme.appBackground
                if colorScheme == .dark {
                    RadialGradient(
                        colors: [
                            Color(red: 0.15, green: 0.127, blue: 0.257),
                            Color(red: 0.056, green: 0.052, blue: 0.109),
                            Color(red: 0.015, green: 0.016, blue: 0.035),
                        ],
                        center: UnitPoint(x: 0.18, y: -0.1),
                        startRadius: 0,
                        endRadius: size.height * 1.1
                    )
                }
                blob(420, opacity: 0.55, blur: 70).position(x: 80, y: 70)
                blob(380, opacity: 0.40, blur: 80).position(x: size.width + 30, y: 360)
                blob(360, opacity: 0.35, blur: 80).position(x: 60, y: size.height - 70)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private func blob(_ diameter: CGFloat, opacity: Double, blur: CGFloat) -> some View {
        Circle()
            .fill(Theme.primary)
            .frame(width: diameter, height: diameter)
            .opacity(opacity)
            .blur(radius: blur)
    }
}

/// Logomark.tsx: three frosted circles with a purple core.
struct Logomark: View {
    var size: CGFloat = 24

    var body: some View {
        let s = size / 56
        ZStack {
            circle(r: 16, x: 22, y: 25, fill: .white.opacity(0.55), scale: s)
            circle(r: 11, x: 35, y: 19, fill: .white.opacity(0.4), scale: s)
            circle(r: 9, x: 29, y: 35, fill: .white.opacity(0.3), scale: s)
            circle(r: 5.5, x: 25, y: 27, fill: Theme.primary, scale: s)
        }
        .frame(width: size, height: size)
    }

    private func circle(r: CGFloat, x: CGFloat, y: CGFloat, fill: Color, scale: CGFloat) -> some View {
        Circle()
            .fill(fill)
            .frame(width: r * 2 * scale, height: r * 2 * scale)
            .position(x: x * scale, y: y * scale)
    }
}

/// Round glass icon button used in the header (settings, library…).
struct GlassIconButton: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.text)
                .frame(width: 36, height: 36)
                .glassCard(cornerRadius: 18)
        }
        // Borderless keeps each button's tap separate when several share a List row
        // (with the default style, iOS fires one button for a tap anywhere in the row).
        .buttonStyle(.borderless)
        .accessibilityLabel(label)
    }
}
