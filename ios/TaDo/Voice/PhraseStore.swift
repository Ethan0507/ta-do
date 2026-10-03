import Foundation
import Observation
import Supabase

/// The user's voice command phrases: app defaults, minus the ones they've switched off,
/// plus their own. Saved in `voice_phrases` (synced) and cached on the phone so voice
/// capture and Siri use them offline and instantly.
@MainActor
@Observable
final class PhraseStore {
    static let shared = PhraseStore()
    private static let cacheKey = "ta-do-voice-phrases"

    struct Row: Codable, Identifiable, Hashable {
        var id: UUID?
        let action: CommandAction
        let phrase: String
        let kind: String // "custom" | "disabled_default"
    }

    private(set) var rows: [Row] = PhraseStore.cachedRows()

    var custom: [Row] { rows.filter { $0.kind == "custom" } }
    var disabledDefaults: Set<String> { Set(rows.filter { $0.kind == "disabled_default" }.map { Self.key($0.action, $0.phrase) }) }

    /// What the parser should use right now.
    var effectivePhrases: [CommandPhrase] { Self.effective(from: rows) }

    func parser() -> CommandParser {
        var parser = CommandParser()
        parser.phrases = effectivePhrases
        return parser
    }

    /// For contexts without the store loaded (e.g. a Siri intent): the cached phrases.
    nonisolated static func cachedParser() -> CommandParser {
        var parser = CommandParser()
        parser.phrases = effective(from: cachedRows())
        return parser
    }

    func load() async {
        do {
            let fetched: [Row] = try await supabase.from("voice_phrases")
                .select("id, action, phrase, kind").order("created_at").execute().value
            rows = fetched
            Self.saveCache(fetched)
        } catch {
            print("Voice phrases load failed: \(error)")
        }
    }

    enum PhraseError: LocalizedError {
        case empty, tooLong, alreadyUsed(CommandAction)
        var errorDescription: String? {
            switch self {
            case .empty: "Type a phrase first."
            case .tooLong: "Keep phrases under 40 characters."
            case .alreadyUsed(let action): "That phrase is already used for \(action.title)."
            }
        }
    }

    func addCustom(_ phrase: String, to action: CommandAction, userID: UUID) async throws {
        let trimmed = phrase.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { throw PhraseError.empty }
        guard trimmed.count <= 40 else { throw PhraseError.tooLong }
        if let clash = effectivePhrases.first(where: { $0.phrase.lowercased() == trimmed }) {
            throw PhraseError.alreadyUsed(clash.action)
        }
        let row: Row = try await supabase.from("voice_phrases")
            .insert(InsertRow(user_id: userID, action: action, phrase: trimmed, kind: "custom"))
            .select("id, action, phrase, kind").single().execute().value
        rows.append(row)
        Self.saveCache(rows)
    }

    func removeCustom(_ row: Row) async throws {
        guard let id = row.id else { return }
        try await supabase.from("voice_phrases").delete().eq("id", value: id).execute()
        rows.removeAll { $0.id == id }
        Self.saveCache(rows)
    }

    /// Switch a default phrase on or off.
    func setDefault(_ phrase: CommandPhrase, enabled: Bool, userID: UUID) async throws {
        let key = Self.key(phrase.action, phrase.phrase)
        if enabled {
            let matching = rows.filter { $0.kind == "disabled_default" && Self.key($0.action, $0.phrase) == key }
            for row in matching {
                if let id = row.id { try await supabase.from("voice_phrases").delete().eq("id", value: id).execute() }
            }
            rows.removeAll { $0.kind == "disabled_default" && Self.key($0.action, $0.phrase) == key }
        } else {
            guard !disabledDefaults.contains(key) else { return }
            let row: Row = try await supabase.from("voice_phrases")
                .insert(InsertRow(user_id: userID, action: phrase.action, phrase: phrase.phrase, kind: "disabled_default"))
                .select("id, action, phrase, kind").single().execute().value
            rows.append(row)
        }
        Self.saveCache(rows)
    }

    private struct InsertRow: Encodable {
        let user_id: UUID
        let action: CommandAction
        let phrase: String
        let kind: String
    }

    nonisolated private static func key(_ action: CommandAction, _ phrase: String) -> String {
        "\(action.rawValue)|\(phrase.lowercased())"
    }

    nonisolated static func effective(from rows: [Row]) -> [CommandPhrase] {
        CommandParser.effectivePhrases(
            disabled: rows.filter { $0.kind == "disabled_default" }.map { CommandPhrase(action: $0.action, phrase: $0.phrase) },
            custom: rows.filter { $0.kind == "custom" }.map { CommandPhrase(action: $0.action, phrase: $0.phrase) }
        )
    }

    nonisolated private static func cachedRows() -> [Row] {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return [] }
        return (try? JSONDecoder().decode([Row].self, from: data)) ?? []
    }

    nonisolated private static func saveCache(_ rows: [Row]) {
        if let data = try? JSONEncoder().encode(rows) { UserDefaults.standard.set(data, forKey: cacheKey) }
    }
}

extension CommandAction {
    var title: String {
        switch self {
        case .task: "Task"
        case .thought: "Thought"
        case .goal: "Goal"
        case .label: "Label"
        case .repeating: "Repeat"
        case .due: "Due date"
        case .note: "Note"
        case .next: "Next entry"
        }
    }

    var explanation: String {
        switch self {
        case .task: "Makes the entry a task. Plain “task” only counts at the start."
        case .thought: "Makes the entry a thought."
        case .goal: "Makes the entry a goal."
        case .label: "Adds the words after it as labels (“and” for several)."
        case .repeating: "Makes it a repeating task — daily, weekdays, every Monday, monthly…"
        case .due: "Sets a due date. Dates like “tomorrow at 6” also work without it."
        case .note: "Everything after it becomes the entry's note. Say it last."
        case .next: "Starts another entry in the same recording."
        }
    }

    var example: String {
        switch self {
        case .task: "Task call the electrician"
        case .thought: "Thought maybe switch desks"
        case .goal: "New goal run a half marathon"
        case .label: "Plan the trip label as travel"
        case .repeating: "Stretch every weekday at 7 am"
        case .due: "Send the invoice due Friday"
        case .note: "Book the dentist with a note ask about whitening"
        case .next: "Buy milk next item call mom"
        }
    }

    var symbol: String {
        switch self {
        case .task: "checkmark.square"
        case .thought: "lightbulb"
        case .goal: "flag"
        case .label: "tag"
        case .repeating: "repeat"
        case .due: "calendar"
        case .note: "note.text"
        case .next: "arrow.turn.down.right"
        }
    }
}
