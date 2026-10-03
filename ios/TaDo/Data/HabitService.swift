import Foundation
import Supabase

/// Repeating tasks — mirrors src/lib/habits.ts. Spec: docs/schema.md "Recurring tasks — specification".
enum HabitService {
    static func fetchHabit(_ id: UUID) async throws -> Habit? {
        let rows: [Habit] = try await supabase.from("habits").select().eq("id", value: id).limit(1).execute().value
        return rows.first
    }

    /// The template entry for a Habit (the series' config, shown in Library).
    static func fetchTemplate(habitID: UUID) async throws -> Entry? {
        let rows: [Entry] = try await supabase
            .from("entries")
            .select()
            .eq("habit_id", value: habitID)
            .eq("is_recurrence_template", value: true)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Creates today's tasks from this user's templates (and marks past ones missed).
    static func generateTodaysTasks() async throws {
        try await supabase.rpc("generate_habit_entries").execute()
    }

    private struct IDRow: Decodable { let id: UUID }

    /// - First rule: creates the Habit, turns the entry into the template, makes it active.
    /// - Changed rule/title: updates the Habit; only tasks generated from now on pick it up.
    /// - Cleared rule: deletes the Habit and turns the template back into a normal task.
    static func setRecurrence(entryID: UUID, userID: UUID, title: String, rule: RecurrenceRule?, existingHabitID: UUID?) async throws {
        guard let rule else {
            guard let existingHabitID else { return }
            try await supabase.from("entries")
                .update(["is_recurrence_template": AnyJSON.bool(false), "habit_id": .null])
                .eq("id", value: entryID).execute()
            try await supabase.from("habits").delete().eq("id", value: existingHabitID).execute()
            return
        }

        struct HabitWrite: Encodable {
            let user_id: UUID?
            let title: String
            let recurrence_rule: RecurrenceRule
        }

        if let existingHabitID {
            try await supabase.from("habits")
                .update(HabitWrite(user_id: nil, title: title, recurrence_rule: rule))
                .eq("id", value: existingHabitID).execute()
            return
        }

        let routineID = try await routineID(for: userID)
        let habit: IDRow = try await supabase.from("habits")
            .insert(HabitWrite(user_id: userID, title: title, recurrence_rule: rule))
            .select("id").single().execute().value

        // Only link if the entry isn't already a template, so a double-tapped Save can't
        // leave two Habits for one task.
        let linked: [IDRow] = try await supabase.from("entries")
            .update([
                "habit_id": AnyJSON.string(habit.id.uuidString),
                "is_recurrence_template": .bool(true),
                "due_date": .null,
                "due_time": .null,
                "task_status": .string("open"),
                "completed_at": .null,
            ])
            .eq("id", value: entryID)
            .is("habit_id", value: nil)
            .select("id")
            .execute()
            .value
        guard !linked.isEmpty else {
            try await supabase.from("habits").delete().eq("id", value: habit.id).execute()
            return
        }

        try await supabase.from("routine_habits")
            .insert(["routine_id": routineID.uuidString, "habit_id": habit.id.uuidString])
            .execute()

        // Today's task appears right away if today matches.
        try? await generateTodaysTasks()
    }

    private static func routineID(for userID: UUID) async throws -> UUID {
        let rows: [IDRow] = try await supabase.from("routines").select("id").eq("user_id", value: userID).limit(1).execute().value
        if let existing = rows.first { return existing.id }
        let created: IDRow = try await supabase.from("routines")
            .insert(["user_id": userID.uuidString]).select("id").single().execute().value
        return created.id
    }
}
