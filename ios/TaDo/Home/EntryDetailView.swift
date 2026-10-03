import SwiftUI

/// Basic detail sheet: text, type, due date (tasks), notes, done, archive.
/// Repeat setup and categories still happen on the web for now.
struct EntryDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let entry: Entry
    let onChanged: () async -> Void

    @State private var content: String
    @State private var notes: String
    @State private var type: EntryType
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var done: Bool
    @State private var saving = false
    @State private var error: String?

    init(entry: Entry, onChanged: @escaping () async -> Void) {
        self.entry = entry
        self.onChanged = onChanged
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
                    TextField("Entry", text: $content, axis: .vertical)
                        .lineLimit(1...6)
                    Picker("Type", selection: $type) {
                        ForEach(EntryType.allCases) { Text($0.rawValue.capitalized).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                if type == .task {
                    Section {
                        Toggle("Due date", isOn: $hasDueDate)
                        if hasDueDate {
                            DatePicker("Date", selection: $dueDate, displayedComponents: .date)
                        }
                        if entry.habitID != nil {
                            Label("Created from a repeating task — edit the series on the web for now", systemImage: "repeat")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if type != .thought {
                    Section {
                        Toggle(type == .task ? "Done" : "Achieved", isOn: $done)
                    }
                }

                Section("Notes") {
                    TextField("Add notes…", text: $notes, axis: .vertical)
                        .lineLimit(3...10)
                }

                Section {
                    Button(entry.archivedAt == nil ? "Archive" : "Unarchive", role: .destructive) {
                        run {
                            try await EntryService.setArchived(entry, entry.archivedAt == nil)
                        }
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
            .navigationTitle(entry.type.rawValue.capitalized)
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
    }

    private func save() {
        run {
            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
            if type != entry.type {
                try await EntryService.setType(entry, type)
            } else if done != entry.isDone {
                // Only on an actual toggle, so saving notes on a missed task doesn't reopen it.
                try await EntryService.setDone(entry, done)
            }
            if trimmed != entry.content || trimmedNotes != (entry.notes ?? "") {
                try await EntryService.setContent(entry, content: trimmed, notes: trimmedNotes)
            }
            if type == .task {
                let newDue = hasDueDate ? Self.format(dueDate) : nil
                if newDue != entry.dueDate { try await EntryService.setDueDate(entry, newDue) }
            }
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
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
