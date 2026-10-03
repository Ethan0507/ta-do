import AppIntents
import Foundation
import Supabase

extension EntryType: AppEnum {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Entry type"
    static let caseDisplayRepresentations: [EntryType: DisplayRepresentation] = [
        .thought: "Thought",
        .task: "Task",
        .goal: "Goal",
    ]
}

enum IntentFailure: Error, CustomLocalizedStringResourceConvertible {
    case signedOut

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .signedOut: "Open Ta-do and sign in first."
        }
    }
}

/// "Brain dump in Ta-do" / "Add a task to Ta-do": Siri asks what's on your mind and
/// saves it without opening the app.
struct AddEntryIntent: AppIntent {
    static let title: LocalizedStringResource = "Add to Ta-do"
    static let description = IntentDescription("Capture a thought, task or goal without opening Ta-do.")

    /// Runs in the background; switches to the app only for "Edit in Ta-do".
    static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]

    @Parameter(title: "Type", default: .thought)
    var type: EntryType

    @Parameter(title: "Text", requestValueDialog: "What's on your mind?")
    var text: String

    static var parameterSummary: some ParameterSummary {
        Summary("Add \(\.$type) \(\.$text) to Ta-do")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let session = try? await supabase.auth.session else { throw IntentFailure.signedOut }
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return .result(dialog: "Nothing to add.") }

        // Same voice command phrases as in the app ("… tomorrow at 6, label as family").
        // Fetch the latest custom phrases first (falls back to the phone's copy offline).
        await PhraseStore.shared.load()
        let parsed = await PhraseStore.shared.parser().parse(content)
        guard !parsed.isEmpty else { return .result(dialog: "Nothing to add.") }

        // Say what was understood and let the user choose, with Siri's own buttons
        // (custom buttons inside a Siri card don't run). Cancel throws, so nothing is saved.
        let save = IntentChoiceOption(title: "Save")
        let edit = IntentChoiceOption(title: "Edit in Ta-do")
        let prompt = "Heard: “\(content)”. \(CommandExecutor.preview(of: parsed, defaultType: type)) Save it?"
        let choice = try await requestChoice(between: [save, edit, .cancel], dialog: IntentDialog(stringLiteral: prompt))

        if choice == edit {
            // Open the app on the full review card with the same words.
            await MainActor.run { AppRouter.shared.requestVoiceCapture(type: type, prefill: content) }
            try await continueInForeground(alwaysConfirm: false)
            return .result(dialog: "Opening Ta-do.")
        }
        guard choice == save else { return .result(dialog: "Nothing saved.") }

        try await CommandExecutor.save(parsed, defaultType: type, userID: session.user.id)
        return .result(dialog: IntentDialog(stringLiteral: CommandExecutor.summary(of: parsed, defaultType: type)))
    }
}

/// "Talk to Ta-do": opens the app straight into voice capture.
struct VoiceCaptureIntent: AppIntent {
    static let title: LocalizedStringResource = "Capture by voice"
    static let description = IntentDescription("Open Ta-do listening, ready to capture.")
    static let openAppWhenRun = true

    @Parameter(title: "Type")
    var type: EntryType?

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.requestVoiceCapture(type: type)
        return .result()
    }
}

/// Built-in Siri phrases — available as soon as the app is installed, no setup.
/// Apple requires each phrase to contain the app name.
struct TaDoShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddEntryIntent(),
            phrases: [
                "Brain dump in \(.applicationName)",
                "Capture in \(.applicationName)",
                "Add a \(\.$type) to \(.applicationName)",
                "New \(\.$type) in \(.applicationName)",
            ],
            shortTitle: "Add to Ta-do",
            systemImageName: "plus.bubble"
        )
        AppShortcut(
            intent: VoiceCaptureIntent(),
            phrases: [
                "Talk to \(.applicationName)",
                "Open \(.applicationName) voice capture",
            ],
            shortTitle: "Voice capture",
            systemImageName: "mic"
        )
    }
}
