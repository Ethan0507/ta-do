import SwiftUI

/// One entry being created — the same card everywhere an entry is made (typed capture,
/// voice, Siri's "Edit in Ta-do", several at once). Text plus a chip per option; tap a
/// chip to change it, ✕ to remove it, "+ …" to add one that isn't set.
struct DraftCard: View {
    @Binding var entry: ParsedEntry
    let defaultType: EntryType
    let categories: [Category]
    var editable = true
    var onRemove: (() -> Void)?
    var onCreateLabel: ((String) async -> Void)?

    private enum Sheet: String, Identifiable { case date, repeating, labels, note; var id: String { rawValue } }
    @State private var sheet: Sheet?

    private var type: EntryType { entry.resolvedType(default: defaultType) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                TextField("What's on your mind?", text: $entry.content, axis: .vertical)
                    .font(.system(size: 17, weight: .semibold))
                    .lineLimit(1...4)
                    .disabled(!editable)
                if let onRemove, editable {
                    Button(action: onRemove) {
                        Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
                            .frame(width: 26, height: 26).background(Theme.field, in: Circle())
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Remove this entry")
                }
            }

            FlowLayout(spacing: 6) {
                typeChip

                if type == .task {
                    if let rule = entry.repeatRule {
                        option(rule.summary, icon: "repeat", open: .repeating) { entry.repeatRule = nil }
                    } else if let due = entry.dueDate {
                        option(CommandExecutor.describeDay(due).capitalized + (entry.dueTime.map { " · \($0)" } ?? ""),
                               icon: "calendar", open: .date) {
                            entry.dueDate = nil
                            entry.dueTime = nil
                        }
                    }
                }
                ForEach(entry.labels, id: \.self) { name in
                    let existing = CommandExecutor.matchLabel(name, in: categories)
                    option(existing?.name ?? "\(name.capitalized) (new)", icon: "tag", open: .labels) {
                        entry.labels.removeAll { $0 == name }
                    }
                }
                if let note = entry.note {
                    option(note, icon: "note.text", open: .note) { entry.note = nil }
                }

                if editable {
                    if type == .task && entry.repeatRule == nil && entry.dueDate == nil {
                        add("Date", open: .date)
                        add("Repeat", open: .repeating)
                    }
                    add("Label", open: .labels)
                    if entry.note == nil { add("Note", open: .note) }
                }
            }
        }
        .padding(16)
        .glassCard(cornerRadius: 20, strong: true)
        .sheet(item: $sheet) { which in
            NavigationStack {
                sheetContent(which)
                    .scrollContentBackground(.hidden)
                    .background(GlassBackdrop())
            }
            .presentationDetents([.medium, .large])
            .tint(Theme.primary)
            .foregroundStyle(Theme.text)
        }
    }

    // MARK: Chips

    private var typeChip: some View {
        Menu {
            Picker("Type", selection: Binding(get: { type }, set: { entry.type = $0 })) {
                ForEach(EntryType.allCases) { Label($0.rawValue.capitalized, systemImage: $0.symbol).tag($0) }
            }
        } label: {
            chipBody(type.rawValue.capitalized, icon: type.symbol, prominent: true)
        }
        .buttonStyle(.borderless)
        .disabled(!editable)
    }

    private func option(_ text: String, icon: String, open: Sheet, remove: @escaping () -> Void) -> some View {
        HStack(spacing: 0) {
            Button { if editable { sheet = open } } label: {
                HStack(spacing: 5) {
                    Image(systemName: icon)
                    Text(text).lineLimit(1)
                }
                .padding(.leading, 10)
                .padding(.trailing, editable ? 4 : 10)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderless)
            if editable {
                Button(action: remove) {
                    Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.textFaint)
                        .padding(.trailing, 10)
                        .padding(.leading, 2)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Remove \(text)")
            }
        }
        .font(.system(size: 12.5, weight: .semibold))
        .foregroundStyle(Theme.text)
        .background(Theme.field, in: Capsule())
    }

    private func add(_ title: String, open: Sheet) -> some View {
        Button { sheet = open } label: {
            Text("+ \(title)")
                .font(.system(size: 12.5, weight: .semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .foregroundStyle(Theme.primary)
                .overlay { Capsule().strokeBorder(Theme.primary.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [3])) }
        }
        .buttonStyle(.borderless)
    }

    private func chipBody(_ text: String, icon: String, prominent: Bool) -> some View {
        // Icon + text built by hand: a Label inside a Menu in a List row renders icon-only.
        HStack(spacing: 5) {
            Image(systemName: icon)
            Text(text)
        }
        .font(.system(size: 12.5, weight: .semibold))
        .lineLimit(1)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .foregroundStyle(prominent ? Theme.primaryOn : Theme.text)
        .background(prominent ? Theme.primary : Theme.field, in: Capsule())
    }

    // MARK: Option editors

    @ViewBuilder private func sheetContent(_ which: Sheet) -> some View {
        switch which {
        case .date:
            DueDateEditor(date: $entry.dueDate, time: $entry.dueTime)
                .navigationTitle("Due date")
                .toolbar { done }
        case .repeating:
            Form {
                RepeatPicker(rule: $entry.repeatRule, referenceDate: entry.dueDate ?? Date())
                    .listRowBackground(Theme.glassFillStrong)
            }
            .navigationTitle("Repeat")
            .toolbar { done }
            .onAppear { if entry.repeatRule == nil { entry.repeatRule = RecurrenceRule(freq: .daily) } }
        case .labels:
            Form {
                CategoryChips(
                    all: categories + newLabelPlaceholders,
                    selected: Binding(
                        get: { selectedLabelIDs },
                        set: { ids in entry.labels = labelNames(for: ids) }
                    )
                ) { name in
                    if let onCreateLabel { await onCreateLabel(name) } else { entry.labels.append(name) }
                }
                .listRowBackground(Theme.glassFillStrong)
            }
            .navigationTitle("Labels")
            .toolbar { done }
        case .note:
            Form {
                TextField("Add a note…", text: Binding(get: { entry.note ?? "" }, set: { entry.note = $0.isEmpty ? nil : $0 }), axis: .vertical)
                    .lineLimit(3...10)
                    .listRowBackground(Theme.glassFillStrong)
            }
            .navigationTitle("Note")
            .toolbar { done }
        }
    }

    private var done: some ToolbarContent {
        ToolbarItem(placement: .confirmationAction) { Button("Done") { sheet = nil } }
    }

    // Labels on a draft are names (a new one isn't created until save), so new names get
    // stand-in categories while picking.
    private var newLabelPlaceholders: [Category] {
        entry.labels
            .filter { CommandExecutor.matchLabel($0, in: categories) == nil }
            .map { Category(id: Self.placeholderID(for: $0), userID: nil, name: $0.capitalized) }
    }

    private var selectedLabelIDs: [UUID] {
        entry.labels.map { name in CommandExecutor.matchLabel(name, in: categories)?.id ?? Self.placeholderID(for: name) }
    }

    private func labelNames(for ids: [UUID]) -> [String] {
        (categories + newLabelPlaceholders).filter { ids.contains($0.id) }.map(\.name)
    }

    private static func placeholderID(for name: String) -> UUID {
        // Stable per name so selection survives re-renders.
        var hasher = Hasher()
        hasher.combine(name.lowercased())
        let h = UInt64(bitPattern: Int64(hasher.finalize()))
        let s = String(format: "%016llx", h)
        return UUID(uuidString: "00000000-0000-4000-8000-" + String(s.suffix(12))) ?? UUID()
    }
}

/// Date + optional time, same as the detail sheet.
struct DueDateEditor: View {
    @Binding var date: Date?
    @Binding var time: String?

    var body: some View {
        Form {
            Group {
            DatePicker("Date", selection: Binding(get: { date ?? Calendar.current.startOfDay(for: Date()) },
                                                  set: { date = Calendar.current.startOfDay(for: $0) }),
                       displayedComponents: .date)
                .datePickerStyle(.graphical)
            Toggle("Time", isOn: Binding(get: { time != nil }, set: { time = $0 ? "09:00" : nil }))
            if let time {
                DatePicker("At", selection: Binding(get: { Self.date(from: time) }, set: { self.time = Self.string(from: $0) }),
                           displayedComponents: .hourAndMinute)
            }
            }
            .listRowBackground(Theme.glassFillStrong)
        }
        .onAppear { if date == nil { date = Calendar.current.startOfDay(for: Date()) } }
    }

    static func date(from time: String) -> Date {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: parts.first ?? 9, minute: parts.count > 1 ? parts[1] : 0, second: 0, of: Date()) ?? Date()
    }

    static func string(from date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}
