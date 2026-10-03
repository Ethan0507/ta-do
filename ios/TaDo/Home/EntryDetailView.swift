import SwiftUI

/// Entry detail — same rules as the web EntryDetail:
/// - Templates (a repeating task's config): no type switch, no due date, no "done";
///   the Repeat picker edits the rule, and changes apply to tasks created from now on.
/// - Generated tasks: independent; no Repeat picker, an "Edit repeating task" link instead.
/// - Plain tasks: due date and Repeat picker.
struct EntryDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let entry: Entry
    let userID: UUID
    let onChanged: () async -> Void
    /// Opens a generated task's template where templates live (Library).
    var onOpenTemplate: ((Entry) -> Void)?

    @State private var content: String
    @State private var notes: String
    @State private var type: EntryType
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var done: Bool
    @State private var rule: RecurrenceRule?
    @State private var initialRule: RecurrenceRule?
    @State private var template: Entry?
    @State private var categories: [Category] = []
    @State private var categoryIDs: [UUID] = []
    @State private var initialCategoryIDs: [UUID] = []
    @State private var saving = false
    @State private var error: String?

    private var isTemplate: Bool { entry.isRecurrenceTemplate }
    private var isGenerated: Bool { entry.isGenerated }

    init(entry: Entry, userID: UUID, onChanged: @escaping () async -> Void, onOpenTemplate: ((Entry) -> Void)? = nil) {
        self.entry = entry
        self.userID = userID
        self.onChanged = onChanged
        self.onOpenTemplate = onOpenTemplate
        _content = State(initialValue: entry.content)
        _notes = State(initialValue: entry.notes ?? "")
        _type = State(initialValue: entry.type)
        _hasDueDate = State(initialValue: entry.dueDate != nil)
        _dueDate = State(initialValue: entry.dueDate.flatMap(Self.parse) ?? Date())
        _done = State(initialValue: entry.isDone)
    }

    var body: some View {
        NavigationStack {
            Form {
                Group {
                    Section {
                        if isTemplate {
                            Label("Repeating task — changes apply to tasks created from now on", systemImage: "repeat")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.textMuted)
                        }
                        TextField("Entry", text: $content, axis: .vertical)
                            .lineLimit(1...6)
                        if !isTemplate {
                            Picker("Type", selection: $type) {
                                ForEach(EntryType.allCases) { Text($0.rawValue.capitalized).tag($0) }
                            }
                            .pickerStyle(.segmented)
                        }
                    }

                    if type == .task {
                        if !isTemplate {
                            Section {
                                Toggle("Due date", isOn: $hasDueDate)
                                if hasDueDate {
                                    DatePicker("Date", selection: $dueDate, displayedComponents: .date)
                                }
                            }
                        }
                        if isGenerated {
                            if let template, let onOpenTemplate {
                                Section {
                                    Button {
                                        onOpenTemplate(template)
                                    } label: {
                                        Label("Edit repeating task", systemImage: "repeat")
                                    }
                                }
                            }
                        } else {
                            Section("Repeat") {
                                RepeatPicker(rule: $rule, referenceDate: hasDueDate ? dueDate : Date())
                            }
                        }
                    }

                    if type != .thought && !isTemplate {
                        Section {
                            Toggle(type == .task ? "Done" : "Achieved", isOn: $done)
                        }
                    }

                    Section("Notes") {
                        TextField("Add notes…", text: $notes, axis: .vertical)
                            .lineLimit(3...10)
                    }

                    Section("Categories") {
                        CategoryChips(all: categories, selected: $categoryIDs) { name in
                            if let created = try? await CategoryService.create(userID: userID, name: name) {
                                categories.append(created)
                                categories.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                            }
                        }
                    }

                    Section {
                        Button(entry.archivedAt == nil ? "Archive" : "Unarchive", role: entry.archivedAt == nil ? .destructive : nil) {
                            run { try await EntryService.setArchived(entry, entry.archivedAt == nil) }
                        }
                    }

                    if let error {
                        Text(error).foregroundStyle(.red).font(.footnote)
                    }
                }
                .listRowBackground(Theme.glassFillStrong)
            }
            .scrollContentBackground(.hidden)
            .background(GlassBackdrop())
            .tint(Theme.primary)
            .navigationTitle(isTemplate ? "Repeating task" : entry.type.rawValue.capitalized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save)
                        .disabled(saving || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .task { await loadExtras() }
    }

    private func loadExtras() async {
        async let all = try? CategoryService.fetchAll()
        async let links = try? CategoryService.fetchEntryCategoryIDs()
        categories = await all ?? []
        let ids = (await links)?[entry.id] ?? []
        categoryIDs = ids
        initialCategoryIDs = ids

        guard let habitID = entry.habitID else { return }
        if isTemplate {
            let habit = try? await HabitService.fetchHabit(habitID)
            rule = habit?.recurrenceRule
            initialRule = habit?.recurrenceRule
        } else if isGenerated {
            template = try? await HabitService.fetchTemplate(habitID: habitID)
        }
    }

    private func save() {
        run {
            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
            if type != entry.type {
                try await EntryService.setType(entry, type)
            } else if !isTemplate, done != entry.isDone {
                // Only on an actual toggle, so saving notes on a missed task doesn't reopen it.
                try await EntryService.setDone(entry, done)
            }
            if type == .task, !isTemplate {
                let newDue = hasDueDate ? Self.format(dueDate) : nil
                if newDue != entry.dueDate { try await EntryService.setDueDate(entry, newDue) }
            }
            if trimmed != entry.content || trimmedNotes != (entry.notes ?? "") {
                try await EntryService.setContent(entry, content: trimmed, notes: trimmedNotes)
            }
            if Set(categoryIDs) != Set(initialCategoryIDs) {
                try await CategoryService.setCategories(entryID: entry.id, categoryIDs: categoryIDs)
            }
            // Last, so the template is fully saved before today's task is copied from it.
            let templateRenamed = isTemplate && trimmed != entry.content
            if type == .task, !isGenerated, rule != initialRule || templateRenamed {
                try await HabitService.setRecurrence(
                    entryID: entry.id, userID: userID, title: trimmed, rule: rule, existingHabitID: entry.habitID
                )
            }
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        guard !saving else { return }
        saving = true
        Task {
            defer { saving = false }
            do {
                try await action()
                await onChanged()
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private static func parse(_ value: String) -> Date? {
        let format = DateFormatter()
        format.dateFormat = "yyyy-MM-dd"
        format.timeZone = AppDay.timeZone
        return format.date(from: value)
    }

    private static func format(_ date: Date) -> String {
        let format = DateFormatter()
        format.dateFormat = "yyyy-MM-dd"
        format.timeZone = AppDay.timeZone
        return format.string(from: date)
    }
}
