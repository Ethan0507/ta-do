import SwiftUI

/// Full-screen voice capture: listen (live transcript) → review (edit, pick type) → save.
/// The review step is where 2.4's command parsing will show what it understood.
struct VoiceCaptureView: View {
    let initialType: EntryType
    /// Returns false if saving failed.
    let onSave: (String, EntryType) async -> Bool
    let onClose: () -> Void

    @State private var speech = SpeechCapture()
    @State private var text = ""
    @State private var type: EntryType
    @State private var saving = false

    init(initialType: EntryType, onSave: @escaping (String, EntryType) async -> Bool, onClose: @escaping () -> Void) {
        self.initialType = initialType
        self.onSave = onSave
        self.onClose = onClose
        _type = State(initialValue: initialType)
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
        .task { await speech.start() }
        .onChange(of: speech.phase) { _, phase in
            if phase == .done { text = speech.transcript }
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
        VStack(alignment: .leading, spacing: 16) {
            Text("Here's what I heard")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.primary)

            TextField("Nothing heard — type it instead", text: $text, axis: .vertical)
                .lineLimit(2...8)
                .font(.system(size: 18, weight: .medium))
                .padding(16)
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.primary, lineWidth: 1.5)
                }

            HStack {
                TypeMenu(selection: $type)
                Spacer()
            }

            HStack(spacing: 12) {
                Button {
                    Task { await speech.start() }
                } label: {
                    Label("Again", systemImage: "mic")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.field, in: Capsule())
                        .overlay { Capsule().strokeBorder(Theme.glassBorder) }
                }
                Button(action: save) {
                    Text("Save \(type.rawValue)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.primaryOn)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Theme.primary, in: Capsule())
                }
                .disabled(saving || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .opacity(saving || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.6 : 1)
            }
            Spacer()
        }
        .padding(20)
        .glassCard(cornerRadius: 24, strong: true)
        .frame(maxHeight: .infinity, alignment: .top)
        .padding(.top, 40)
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

    private func save() {
        saving = true
        Task {
            if await onSave(text, type) { onClose() }
            saving = false
        }
    }
}
