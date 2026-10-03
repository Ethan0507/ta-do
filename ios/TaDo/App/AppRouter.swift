import Foundation
import Observation

/// App-wide navigation requests that can arrive from outside the view tree
/// (deep links now; Siri, Control Centre and Back Tap later all use tado://capture).
@MainActor
@Observable
final class AppRouter {
    /// One router for the whole app, so App Intents (Siri) can reach it too.
    static let shared = AppRouter()

    /// Set when something asked to open voice capture; Home consumes it.
    var voiceCaptureRequested = false
    var voiceCaptureType: EntryType?
    /// Words to review instead of listening (from Siri's "Edit in Ta-do").
    var voiceCapturePrefill: String?

    func requestVoiceCapture(type: EntryType?, prefill: String? = nil) {
        voiceCaptureType = type
        voiceCapturePrefill = prefill
        voiceCaptureRequested = true
    }

    /// Returns true if the URL was an app link (not a sign-in callback).
    func handle(_ url: URL) -> Bool {
        guard url.scheme == "tado", url.host == "capture" else { return false }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let typeParam = items.first { $0.name == "type" }?.value
        // ?text=… opens the review card with those words instead of listening.
        let text = items.first { $0.name == "text" }?.value
        requestVoiceCapture(type: typeParam.flatMap(EntryType.init(rawValue:)), prefill: text)
        return true
    }
}
