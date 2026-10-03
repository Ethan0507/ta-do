import SwiftUI

/// The shared creation surface: a card per entry, "+ Add another", and Save.
/// Used by the composer sheet (typed capture) and the voice review screen.
struct ComposerList: View {
    @Binding var drafts: [ParsedEntry]
    let defaultType: EntryType
    /// Returns false if saving failed.
    let onSave: ([ParsedEntry]) async -> Bool
    @State private var categories: [Category] = []
    @State private var saving = false

    private var ready: [ParsedEntry] {
        drafts.filter { !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach($drafts) { $draft in
                DraftCard(entry: $draft, defaultType: defaultType, categories: categories,
                          onRemove: drafts.count > 1 ? { drafts.removeAll { $0.id == draft.id } } : nil)
            }

            Button {
                drafts.append(ParsedEntry(content: ""))
            } label: {
                Label("Add another", systemImage: "plus")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.primary)
            }
            .buttonStyle(.borderless)
            .padding(.leading, 4)

            Button(action: save) {
                Text(saveTitle)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.primaryOn)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.primary, in: Capsule())
            }
            .disabled(saving || ready.isEmpty)
            .opacity(saving || ready.isEmpty ? 0.6 : 1)
        }
        .task { categories = (try? await CategoryService.fetchAll()) ?? [] }
    }

    private var saveTitle: String {
        if saving { return "Saving…" }
        if ready.count == 1, let only = ready.first { return "Save \(only.resolvedType(default: defaultType).rawValue)" }
        return "Save \(ready.count)"
    }

    private func save() {
        saving = true
        Task {
            _ = await onSave(ready)
            saving = false
        }
    }
}

/// Sheet version, for typed capture: opened from the + panel's options button, for
/// several lines, or when the text contains voice phrases.
struct EntryComposerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State var drafts: [ParsedEntry]
    let defaultType: EntryType
    let onSave: ([ParsedEntry]) async -> Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                ComposerList(drafts: $drafts, defaultType: defaultType) { entries in
                    let saved = await onSave(entries)
                    if saved { dismiss() }
                    return saved
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(GlassBackdrop())
            .navigationTitle(drafts.count > 1 ? "New entries" : "New \(drafts.first?.resolvedType(default: defaultType).rawValue ?? "entry")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .tint(Theme.primary)
        .foregroundStyle(Theme.text)
    }
}
