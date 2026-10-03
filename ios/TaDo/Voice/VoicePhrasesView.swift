import SwiftUI

/// Settings → Voice phrases: every command action with its phrases, plus a box to try a
/// sentence and see exactly how it would be understood.
struct VoicePhrasesView: View {
    let userID: UUID
    @State private var store = PhraseStore.shared
    @State private var sample = ""
    @State private var categories: [Category] = []

    var body: some View {
        List {
            Group {
                Section {
                    TextField("e.g. Call mom tomorrow at 6 label as family", text: $sample, axis: .vertical)
                        .lineLimit(1...4)
                    let parsed = store.parser().parse(sample)
                    ForEach(parsed) { item in
                        DraftCard(entry: .constant(item), defaultType: .thought, categories: categories, editable: false)
                            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                    }
                } header: {
                    Text("Try a phrase")
                } footer: {
                    Text("Type what you'd say — this is exactly how voice capture and Siri will read it.")
                }

                Section("Actions") {
                    ForEach(CommandAction.allCases) { action in
                        NavigationLink {
                            PhraseActionView(action: action, userID: userID)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: action.symbol)
                                    .foregroundStyle(Theme.primary)
                                    .frame(width: 22)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(action.title).font(.system(size: 15, weight: .semibold))
                                    Text(phrasesSummary(action))
                                        .font(.system(size: 12.5))
                                        .foregroundStyle(Theme.textMuted)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }
            .listRowBackground(Theme.glassFillStrong)
        }
        .scrollContentBackground(.hidden)
        .background(GlassBackdrop())
        .navigationTitle("Voice phrases")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.load()
            categories = (try? await CategoryService.fetchAll()) ?? []
        }
    }

    private func phrasesSummary(_ action: CommandAction) -> String {
        store.effectivePhrases.filter { $0.action == action }.map { "“\($0.phrase)”" }.joined(separator: ", ")
    }
}

/// One action: its default phrases (switch any off) and the user's own phrases.
struct PhraseActionView: View {
    let action: CommandAction
    let userID: UUID
    @State private var store = PhraseStore.shared
    @State private var newPhrase = ""
    @State private var error: String?
    @State private var busy = false

    private var defaults: [CommandPhrase] { CommandParser.defaultPhrases.filter { $0.action == action } }
    private var custom: [PhraseStore.Row] { store.custom.filter { $0.action == action } }

    var body: some View {
        List {
            Group {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(action.explanation).font(.system(size: 14))
                        Text("Example: “\(action.example)”").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    ForEach(custom) { row in
                        Text(row.phrase)
                    }
                    .onDelete { offsets in
                        let rows = offsets.map { custom[$0] }
                        Task {
                            for row in rows { try? await store.removeCustom(row) }
                        }
                    }
                    HStack {
                        TextField("Add your own phrase", text: $newPhrase)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.done)
                            .onSubmit(add)
                        Button("Add", action: add)
                            .disabled(busy || newPhrase.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                } header: {
                    Text("Your phrases")
                } footer: {
                    Text("Say any of these and Ta-do treats it as “\(action.title)”. Swipe to remove.")
                }

                Section {
                    ForEach(defaults, id: \.self) { phrase in
                        Toggle(phrase.phrase, isOn: Binding(
                            get: { !store.disabledDefaults.contains("\(action.rawValue)|\(phrase.phrase.lowercased())") },
                            set: { enabled in Task { try? await store.setDefault(phrase, enabled: enabled, userID: userID) } }
                        ))
                    }
                } header: {
                    Text("Built-in phrases")
                } footer: {
                    Text("Switch off any that get picked up by mistake in normal speech.")
                }
            }
            .listRowBackground(Theme.glassFillStrong)
        }
        .scrollContentBackground(.hidden)
        .background(GlassBackdrop())
        .tint(Theme.primary)
        .navigationTitle(action.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func add() {
        let phrase = newPhrase
        busy = true
        Task {
            defer { busy = false }
            do {
                try await store.addCustom(phrase, to: action, userID: userID)
                newPhrase = ""
                error = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
