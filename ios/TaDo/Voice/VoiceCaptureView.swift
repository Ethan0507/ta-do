import SwiftUI

/// Full-screen voice capture: listen (live transcript) → review (edit, pick type) → save.
/// The review step is where 2.4's command parsing will show what it understood.
struct VoiceCaptureView: View {
    let initialType: EntryType
    /// Already-said words to review straight away instead of listening (Siri's "Edit in Ta-do").
    var prefill: String?
    /// Returns false if saving failed.
    let onSave: ([ParsedEntry], EntryType) async -> Bool
    let onClose: () -> Void

    @State private var speech = SpeechCapture()
    @State private var text = ""
    @State private var parsed: [ParsedEntry] = []
    @State private var editingTranscript = false
    @State private var reviewingPrefill = false
    private var parser: CommandParser { PhraseStore.shared.parser() }

    init(initialType: EntryType, prefill: String? = nil, onSave: @escaping ([ParsedEntry], EntryType) async -> Bool, onClose: @escaping () -> Void) {
        self.initialType = initialType
        self.prefill = prefill
        self.onSave = onSave
        self.onClose = onClose
    }

    var body: some View {
        ZStack {
            GlassBackdrop()
            VStack(spacing: 24) {
                HStack {
                    Spacer()
                    Button {
                        Task { await speech.cancel(); onClose() }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                            .frame(width: 34, height: 34)
                            .glassCard(cornerRadius: 17)
                    }
                    .accessibilityLabel("Close")
                }

                switch speech.phase {
                case _ where reviewingPrefill:
                    review
                case .done:
                    review
                case .permissionDenied:
                    failure("Ta-do needs microphone and speech recognition access. Turn them on in Settings › Ta-do.", showSettings: true)
                case .failed(let message):
                    failure(message, showSettings: false)
                default:
                    listening
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
        .foregroundStyle(Theme.text)
        .task {
            if let prefill, !prefill.isEmpty {
                text = prefill
                parsed = parser.parse(prefill)
                reviewingPrefill = true
            } else {
                await speech.start()
            }
        }
        .onChange(of: speech.phase) { _, phase in
            if phase == .done {
                text = speech.transcript
                parsed = parser.parse(text)
                if parsed.isEmpty { parsed = [ParsedEntry(content: "")] } // nothing heard: type it
            }
        }
        .sensoryFeedback(.start, trigger: speech.phase == .listening)
        .sensoryFeedback(.stop, trigger: speech.phase == .done)
    }

    // MARK: Listening

    private var listening: some View {
        VStack(spacing: 28) {
            Spacer()
            Text(speech.transcript.isEmpty ? placeholder : speech.transcript)
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .foregroundStyle(speech.transcript.isEmpty ? Theme.textMuted : Theme.text)
                .multilineTextAlignment(.center)
                .animation(.default, value: speech.transcript)
                .frame(maxWidth: .infinity)
            Spacer()
            micButton
            Text(hint)
                .font(.system(size: 13))
                .foregroundStyle(Theme.textMuted)
                .padding(.bottom, 24)
        }
    }

    private var placeholder: String {
        speech.phase == .preparing ? "Getting ready…" : "Listening…"
    }

    private var hint: String {
        speech.phase == .listening ? "Pause to finish, or tap to stop" : " "
    }

    private var micButton: some View {
        Button {
            Task { await speech.finish() }
        } label: {
            ZStack {
                Circle()
                    .fill(Theme.primary.opacity(0.25))
                    .frame(width: 132, height: 132)
                    .scaleEffect(1 + CGFloat(speech.level) * 0.35)
                    .animation(.easeOut(duration: 0.12), value: speech.level)
                Circle()
                    .fill(Theme.primary)
                    .frame(width: 88, height: 88)
                    .shadow(color: Theme.primary.opacity(0.45), radius: 14, y: 10)
                Image(systemName: speech.phase == .listening ? "stop.fill" : "mic.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.primaryOn)
            }
        }
        .disabled(speech.phase != .listening)
        .accessibilityLabel("Stop listening")
    }

    // MARK: Review

    private var review: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // What was heard — tap to fix a misheard word; the entries re-read as you type.
                VStack(alignment: .leading, spacing: 6) {
                    Text("You said").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.primary)
                    if editingTranscript {
                        TextField("Type it instead", text: $text, axis: .vertical)
                            .lineLimit(1...6)
                            .onChange(of: text) { parsed = parser.parse(text) }
                    } else {
                        Button {
                            editingTranscript = true
                        } label: {
                            HStack(alignment: .top) {
                                Text(text.isEmpty ? "Nothing heard — tap to type" : "“\(text)”")
                                    .multilineTextAlignment(.leading)
                                    .foregroundStyle(Theme.textMuted)
                                Spacer()
                                Image(systemName: "pencil").foregroundStyle(Theme.textFaint)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .font(.system(size: 14))

                ComposerList(drafts: $parsed, defaultType: initialType) { entries in
                    let saved = await onSave(entries, initialType)
                    if saved { onClose() }
                    return saved
                }

                Button {
                    editingTranscript = false
                    reviewingPrefill = false
                    Task { await speech.start() }
                } label: {
                    Label("Say it again", systemImage: "mic")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Theme.field, in: Capsule())
                        .overlay { Capsule().strokeBorder(Theme.glassBorder) }
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 24)
        }
        .scrollDismissesKeyboard(.interactively)
    }



    private func failure(_ message: String, showSettings: Bool) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "mic.slash")
                .font(.system(size: 40))
                .foregroundStyle(Theme.textMuted)
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.textMuted)
            if showSettings {
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                }
                .tint(Theme.primary)
            } else {
                Button("Type it instead") { onClose() }
                    .tint(Theme.primary)
            }
            Spacer()
        }
    }

}
