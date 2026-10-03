import Foundation

enum EntryType: String, Codable, CaseIterable, Identifiable {
    case thought, task, goal
    var id: String { rawValue }
    var plural: String {
        switch self {
        case .thought: "Thoughts"
        case .task: "Tasks"
        case .goal: "Goals"
        }
    }
}

/// One row of `entries` — see docs/schema.md. Dates are kept as the strings Postgres
/// returns (`due_date` is "YYYY-MM-DD", `due_time` is "HH:MM:SS").
struct Entry: Codable, Identifiable, Hashable {
    let id: UUID
    var type: EntryType
    var content: String
    var notes: String?
    let createdAt: String
    var archivedAt: String?
    var habitID: UUID?
    var position: Double?
    var dueDate: String?
    var dueTime: String?
    var taskStatus: String?
    var completedAt: String?
    var isRecurrenceTemplate: Bool
    var isGenerated: Bool
    var goalStatus: String?
    var achievedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, type, content, notes, position
        case createdAt = "created_at"
        case archivedAt = "archived_at"
        case habitID = "habit_id"
        case dueDate = "due_date"
        case dueTime = "due_time"
        case taskStatus = "task_status"
        case completedAt = "completed_at"
        case isRecurrenceTemplate = "is_recurrence_template"
        case isGenerated = "is_generated"
        case goalStatus = "goal_status"
        case achievedAt = "achieved_at"
    }

    var isDone: Bool {
        switch type {
        case .task: taskStatus == "done"
        case .goal: goalStatus == "achieved"
        case .thought: false
        }
    }
}

struct Category: Codable, Identifiable, Hashable {
    let id: UUID
    let userID: UUID?
    var name: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case userID = "user_id"
    }
}

/// `habits.recurrence_rule` — see docs/schema.md. Every rule has at most one optional time.
struct RecurrenceRule: Codable, Hashable {
    enum Freq: String, Codable, CaseIterable { case daily, weekly, monthly, custom }

    var freq: Freq
    var weekday: Int?          // weekly: 0 = Sunday … 6 = Saturday
    var dayOfMonth: Int?       // monthly: 1–31
    var weekdays: [Int]?       // custom
    var time: String?          // "HH:MM"

    enum CodingKeys: String, CodingKey {
        case freq, weekday, weekdays, time
        case dayOfMonth = "day_of_month"
    }
}

struct Habit: Codable, Identifiable {
    let id: UUID
    var title: String
    var recurrenceRule: RecurrenceRule

    enum CodingKeys: String, CodingKey {
        case id, title
        case recurrenceRule = "recurrence_rule"
    }
}
