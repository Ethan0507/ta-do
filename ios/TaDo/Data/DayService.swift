import Foundation
import Supabase

/// Mirrors the web app's start-up: keep profiles.timezone in step with the device
/// (unless a timezone was picked manually in Account settings), then make sure today's
/// repeating tasks exist. See docs/schema.md "Recurring tasks — specification".
enum DayService {
    private struct TimezoneAuto: Decodable { let timezone_auto: Bool }
    private struct ProfileTimezone: Decodable { let timezone: String }

    /// Returns the account's timezone after syncing.
    static func prepareDay(userID: UUID) async throws -> String {
        let settings: TimezoneAuto = try await supabase
            .from("user_settings")
            .select("timezone_auto")
            .eq("user_id", value: userID)
            .single()
            .execute()
            .value

        if settings.timezone_auto {
            try await supabase
                .from("profiles")
                .update(["timezone": TimeZone.current.identifier])
                .eq("id", value: userID)
                .execute()
        }

        try await supabase.rpc("generate_habit_entries").execute()

        let profile: ProfileTimezone = try await supabase
            .from("profiles")
            .select("timezone")
            .eq("id", value: userID)
            .single()
            .execute()
            .value
        AppDay.timeZone = TimeZone(identifier: profile.timezone) ?? .current
        return profile.timezone
    }
}
