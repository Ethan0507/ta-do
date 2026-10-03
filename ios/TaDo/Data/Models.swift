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
