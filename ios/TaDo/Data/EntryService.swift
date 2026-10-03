import Foundation
import Supabase

/// Entry reads/writes, matching the web app's src/lib/entries.ts so both apps show the
/// same lists. Visibility rules: docs/schema.md "Recurring tasks — specification".
enum EntryService {
    static let positionGap: Double = 1024

    /// Today's active entries of a type, in manual order. Tasks: undated, due today, or
    /// overdue — except generated tasks from past days, which become missed instead.
    static func fetchToday(_ type: EntryType) async throws -> [Entry] {
        var query = supabase
            .from("entries")
            .select()
            .eq("type", value: type.rawValue)
            .eq("is_recurrence_template", value: false)
            .is("archived_at", value: nil)

        switch type {
        case .task:
            let today = AppDay.today()
            query = query
                .eq("task_status", value: "open")
                .or("due_date.is.null,due_date.eq.\(today),and(due_date.lt.\(today),is_generated.eq.false)")
        case .goal:
            query = query.eq("goal_status", value: "ongoing")
        case .thought:
            break
        }

        return try await query
            .order("position", ascending: true, nullsFirst: false)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    /// Tasks completed / goals achieved today, for the collapsed "completed" section.
    static func fetchCompletedToday(_ type: EntryType) async throws -> [Entry] {
        guard type != .thought else { return [] }
        let (start, end) = AppDay.todayRange()
        let statusColumn = type == .task ? "task_status" : "goal_status"
        let statusValue = type == .task ? "done" : "achieved"
        let timeColumn = type == .task ? "completed_at" : "achieved_at"
        return try await supabase
            .from("entries")
            .select()
            .eq("type", value: type.rawValue)
            .eq(statusColumn, value: statusValue)
            .eq("is_recurrence_template", value: false)
            .gte(timeColumn, value: start)
            .lt(timeColumn, value: end)
            .order(timeColumn, ascending: false)
            .execute()
            .value
    }

    /// Position that puts a new entry above everything currently listed.
    static func topPosition(above entries: [Entry]) -> Double {
        (entries.first?.position ?? positionGap) - positionGap
    }

    static func create(userID: UUID, type: EntryType, content: String, position: Double) async throws {
        let row: [String: AnyJSON] = [
            "user_id": .string(userID.uuidString),
            "type": .string(type.rawValue),
            "content": .string(content),
            "position": .double(position),
            "task_status": type == .task ? .string("open") : .null,
            "goal_status": type == .goal ? .string("ongoing") : .null,
        ]
        try await supabase.from("entries").insert(row).execute()
    }

    static func setDone(_ entry: Entry, _ done: Bool) async throws {
        let row: [String: AnyJSON]
        switch entry.type {
        case .task:
            row = ["task_status": .string(done ? "done" : "open"), "completed_at": done ? .string(AppDay.nowISO()) : .null]
        case .goal:
            row = ["goal_status": .string(done ? "achieved" : "ongoing"), "achieved_at": done ? .string(AppDay.nowISO()) : .null]
        case .thought:
            return
        }
        try await update(entry.id, row)
    }

    static func setArchived(_ entry: Entry, _ archived: Bool) async throws {
        try await update(entry.id, ["archived_at": archived ? .string(AppDay.nowISO()) : .null])
    }

    /// Changing type resets status fields the same way the web app does.
    static func setType(_ entry: Entry, _ type: EntryType) async throws {
        try await update(entry.id, [
            "type": .string(type.rawValue),
            "task_status": type == .task ? .string("open") : .null,
            "completed_at": .null,
            "goal_status": type == .goal ? .string("ongoing") : .null,
            "achieved_at": .null,
        ])
    }

    static func setContent(_ entry: Entry, content: String, notes: String) async throws {
        try await update(entry.id, ["content": .string(content), "notes": notes.isEmpty ? .null : .string(notes)])
    }

    static func setDueDate(_ entry: Entry, _ dueDate: String?) async throws {
        try await update(entry.id, ["due_date": dueDate.map { .string($0) } ?? .null])
    }

    private static func update(_ id: UUID, _ row: [String: AnyJSON]) async throws {
        try await supabase.from("entries").update(row).eq("id", value: id).execute()
    }
}
