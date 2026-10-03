import Foundation

/// Saves what the voice command parser understood, the same way the app's own screens
/// would: create the entry, then date/time, note, labels, and the repeat last (so
/// today's generated task copies everything — see docs/schema.md).
enum CommandExecutor {
    /// Existing labels a parsed name refers to (case-insensitive).
    static func matchLabel(_ name: String, in categories: [Category]) -> Category? {
        categories.first { $0.name.compare(name, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame }
    }

    @discardableResult
    static func save(_ parsed: [ParsedEntry], defaultType: EntryType, userID: UUID) async throws -> [Entry] {
        var categories = try await CategoryService.fetchAll()
        var tops: [EntryType: Double] = [:]
        var saved: [Entry] = []

        for item in parsed {
            let type = item.resolvedType(default: defaultType)
            if tops[type] == nil {
                tops[type] = EntryService.topPosition(above: try await EntryService.fetchToday(type))
            }
            let position = tops[type]!
            tops[type] = position - EntryService.positionGap

            let entry = try await EntryService.create(userID: userID, type: type, content: item.content, position: position)

            if type == .task, item.repeatRule == nil, let due = item.dueDate {
                try await EntryService.setDueDate(entry, formatDay(due))
                if let time = item.dueTime { try await EntryService.setDueTime(entry.id, time) }
            }
            if let note = item.note, !note.isEmpty {
                try await EntryService.setContent(entry, content: item.content, notes: note)
            }
            if !item.labels.isEmpty {
                var ids: [UUID] = []
                for name in item.labels {
                    if let existing = matchLabel(name, in: categories) {
                        ids.append(existing.id)
                    } else {
                        let created = try await CategoryService.create(userID: userID, name: name.capitalized(with: .current))
                        categories.append(created)
                        ids.append(created.id)
                    }
                }
                try await CategoryService.setCategories(entryID: entry.id, categoryIDs: Array(Set(ids)))
            }
            if type == .task, let rule = item.repeatRule {
                try await HabitService.setRecurrence(entryID: entry.id, userID: userID, title: item.content, rule: rule, existingHabitID: nil)
            }
            saved.append(entry)
        }
        return saved
    }

    /// Spoken confirmation for Siri, e.g. "Added task "Call mom" · tomorrow 18:00 · Family".
    static func summary(of parsed: [ParsedEntry], defaultType: EntryType) -> String {
        guard parsed.count == 1, let item = parsed.first else { return "Added \(parsed.count) entries to Ta-do." }
        var parts = ["Added \(item.resolvedType(default: defaultType).rawValue) “\(item.content)”"]
        if let rule = item.repeatRule { parts.append(rule.summary.lowercased()) }
        else if let due = item.dueDate { parts.append(describeDay(due) + (item.dueTime.map { " \($0)" } ?? "")) }
        if !item.labels.isEmpty { parts.append(item.labels.map { $0.capitalized }.joined(separator: ", ")) }
        return parts.joined(separator: " · ")
    }

    /// What Siri reads out before saving, e.g. "Task “Call mom” · tomorrow 18:00 · Family."
    static func preview(of parsed: [ParsedEntry], defaultType: EntryType) -> String {
        parsed.map { item in
            var parts = ["\(item.resolvedType(default: defaultType).rawValue.capitalized) “\(item.content)”"]
            if let rule = item.repeatRule { parts.append(rule.summary.lowercased()) }
            else if let due = item.dueDate { parts.append(describeDay(due) + (item.dueTime.map { " \($0)" } ?? "")) }
            if !item.labels.isEmpty { parts.append(item.labels.map { $0.capitalized }.joined(separator: ", ")) }
            if let note = item.note { parts.append("note: \(note)") }
            return parts.joined(separator: " · ") + "."
        }
        .joined(separator: " ")
    }

    static func describeDay(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "today" }
        if calendar.isDateInTomorrow(date) { return "tomorrow" }
        let format = DateFormatter()
        format.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return format.string(from: date)
    }

    static func formatDay(_ date: Date) -> String {
        let format = DateFormatter()
        format.dateFormat = "yyyy-MM-dd"
        format.calendar = Calendar(identifier: .gregorian)
        return format.string(from: date)
    }
}
