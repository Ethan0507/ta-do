import SwiftUI
import UIKit

/// The web app's design tokens (src/index.css), converted from OKLCH to sRGB.
/// Each colour has a light and dark value and follows the system appearance.
enum Theme {
    static let primary = Color(red: 0.483, green: 0.396, blue: 0.819)
    static let primaryOn = Color(red: 0.986, green: 0.983, blue: 1)
    static let tertiary = Color(red: 0.824, green: 0.47, blue: 0.19)
    static let success = Color(red: 0.218, green: 0.52, blue: 0.242)

    static let text = dynamic(light: (0.1, 0.099, 0.14, 1), dark: (0.931, 0.932, 0.961, 1))
    static let textMuted = dynamic(light: (0.224, 0.224, 0.27, 0.62), dark: (0.801, 0.802, 0.845, 0.65))
    static let textFaint = dynamic(light: (0.224, 0.224, 0.27, 0.45), dark: (0.801, 0.802, 0.845, 0.48))

    static let glassFill = dynamic(light: (0.983, 0.984, 1, 0.55), dark: (0.192, 0.191, 0.258, 0.45))
    static let glassFillStrong = dynamic(light: (0.98, 0.981, 1, 0.85), dark: (0.116, 0.115, 0.177, 0.78))
    static let glassBorder = dynamic(light: (1, 1, 1, 0.55), dark: (1, 1, 1, 0.14))
    /// Nested frosted surfaces (fields, chips) — `bg-white/45` on the web.
    static let field = dynamic(light: (1, 1, 1, 0.45), dark: (1, 1, 1, 0.08))
    static let shadow = dynamic(light: (0.16, 0.13, 0.27, 0.22), dark: (0, 0, 0, 0.45))

    static let appBackground = dynamic(light: (0.863, 0.865, 0.922, 1), dark: (0.04, 0.039, 0.076, 1))

    private typealias RGBA = (CGFloat, CGFloat, CGFloat, CGFloat)

    private static func dynamic(light: RGBA, dark: RGBA) -> Color {
        Color(UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: c.3)
        })
    }
}

extension Font {
    /// Display type (Sora on the web) — SF Rounded keeps the soft geometric feel natively.
    static func display(_ size: CGFloat) -> Font { .system(size: size, weight: .bold, design: .rounded) }
}
