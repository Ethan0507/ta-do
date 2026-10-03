import Foundation

/// "Today" in the account's timezone (profiles.timezone), not the device's — so the app
/// and the server-side repeat generator agree on when a day starts. Mirrors src/lib/day.ts.
enum AppDay {
    nonisolated(unsafe) static var timeZone = TimeZone.current

    private static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    /// Today as YYYY-MM-DD.
    static func today() -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: Date())
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /// Start and end of today as ISO-8601 instants, for `completed_at` / `achieved_at` ranges.
    static func todayRange() -> (start: String, end: String) {
        let start = calendar.startOfDay(for: Date())
        let end = calendar.date(byAdding: .day, value: 1, to: start)!
        let format = ISO8601DateFormatter()
        return (format.string(from: start), format.string(from: end))
    }

    static func nowISO() -> String { ISO8601DateFormatter().string(from: Date()) }
}
