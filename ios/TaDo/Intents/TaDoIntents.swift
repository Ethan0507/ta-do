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

        // Lands at the top of that type's list, same as capturing in the app.
        let current = try await EntryService.fetchToday(type)
        try await EntryService.create(
            userID: session.user.id,
            type: type,
            content: content,
            position: EntryService.topPosition(above: current)
        )
        return .result(dialog: "Added to \(type.plural).")
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
