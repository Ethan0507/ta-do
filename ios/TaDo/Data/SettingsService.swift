import Foundation
import Observation
import Supabase
import SwiftUI

enum ThemePreference: String, Codable, CaseIterable, Identifiable {
    case light, dark, auto
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self {
        case .light: .light
        case .dark: .dark
        case .auto: nil
        }
    }
}

/// Account settings shared with the web app: `user_settings.theme_preference`,
/// `user_settings.timezone_auto` and `profiles.timezone` (see AccountSettings.tsx).
@MainActor
@Observable
final class AppSettings {
    static let shared = AppSettings()
    private static let themeKey = "ta-do-theme"

    /// Cached locally so the right theme shows before the network answers.
    private(set) var theme: ThemePreference =
        ThemePreference(rawValue: UserDefaults.standard.string(forKey: themeKey) ?? "") ?? .auto
    private(set) var timezoneAuto = true
    private(set) var timezone = TimeZone.current.identifier

    private struct Row: Decodable {
        let theme_preference: ThemePreference
        let timezone_auto: Bool
    }
    private struct ProfileRow: Decodable { let timezone: String }

    func load(userID: UUID) async {
        do {
            let row: Row = try await supabase.from("user_settings")
                .select("theme_preference, timezone_auto").eq("user_id", value: userID).single().execute().value
            let profile: ProfileRow = try await supabase.from("profiles")
                .select("timezone").eq("id", value: userID).single().execute().value
            applyTheme(row.theme_preference)
            timezoneAuto = row.timezone_auto
            timezone = profile.timezone
        } catch {
            print("Settings load failed: \(error)")
        }
    }

    func setTheme(_ theme: ThemePreference, userID: UUID) async {
        applyTheme(theme)
        try? await supabase.from("user_settings")
            .update(["theme_preference": theme.rawValue]).eq("user_id", value: userID).execute()
    }

    /// auto = follow the device (synced on every launch); otherwise `zone` sticks.
    func setTimezone(auto: Bool, zone: String, userID: UUID) async throws {
        let newZone = auto ? TimeZone.current.identifier : zone
        try await supabase.from("user_settings")
            .update(["timezone_auto": auto]).eq("user_id", value: userID).execute()
        try await supabase.from("profiles")
            .update(["timezone": newZone]).eq("id", value: userID).execute()
        timezoneAuto = auto
        timezone = newZone
        AppDay.timeZone = TimeZone(identifier: newZone) ?? .current
        try? await HabitService.generateTodaysTasks()
    }

    private func applyTheme(_ theme: ThemePreference) {
        self.theme = theme
        UserDefaults.standard.set(theme.rawValue, forKey: Self.themeKey)
    }
}
