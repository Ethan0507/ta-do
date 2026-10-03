import SwiftUI

/// The web's round purple "+" button.
struct CaptureFab: View {
    let action: () -> Void
    /// Long-press goes straight to voice capture.
    var onLongPress: () -> Void = {}

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Theme.primaryOn)
                .frame(width: 60, height: 60)
                .background(Theme.primary, in: Circle())
                .background(Circle().fill(Theme.glassFill).padding(-6))
                .shadow(color: Theme.primary.opacity(0.45), radius: 13, y: 10)
        }
        .simultaneousGesture(LongPressGesture(minimumDuration: 0.4).onEnded { _ in onLongPress() })
        .accessibilityLabel("Capture")
        .accessibilityHint("Hold to capture by voice")
    }
}

/// The capture panel — like the web's capture form: a glass panel pinned to the
/// bottom that rides on top of the keyboard, over a dimmed Home.
struct CapturePanel: View {
    let type: EntryType
    /// Returns false if saving failed.
    let onSubmit: (String) async -> Bool
    let onClose: () -> Void
    var onVoice: () -> Void = {}
    /// Opens the full composer (date, repeat, labels, note…) with what's typed so far.
    var onOptions: (String) -> Void = { _ in }
    @State private var text = ""
    @State private var sending = false
    @FocusState private var focused: Bool

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("New \(type.rawValue)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.primary)
                Spacer()
                Button {
                    onOptions(text)
                } label: {
                    Label("Options", systemImage: "slider.horizontal.3")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.primary)
                        .padding(.horizontal, 10)
                        .frame(height: 30)
                        .background(Theme.field, in: Capsule())
                }
                .accessibilityHint("Date, repeat, labels and note")
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.text)
                        .frame(width: 30, height: 30)
                        .background(Theme.field, in: Circle())
                }
                .accessibilityLabel("Close")
            }

            HStack(alignment: .bottom, spacing: 12) {
                // Tasks: Return adds a line (several lines → several tasks). Others submit on
                // Return. Attaching onSubmit at all makes Return submit, so tasks don't get it.
                Group {
                    if type == .task {
                        TextField("What's on your mind? One task per line to add several at once.", text: $text, axis: .vertical)
                            .lineLimit(1...6)
                    } else {
                        TextField("What's on your mind?", text: $text, axis: .vertical)
                            .lineLimit(1...4)
                            .submitLabel(.send)
                            .onSubmit(send)
                    }
                }
                .font(.system(size: 16))
                .focused($focused)
                .padding(.horizontal, 18)
                .padding(.vertical, 15)
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Theme.primary, lineWidth: 1.5)
                }

                if trimmed.isEmpty {
                    Button(action: onVoice) {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Theme.primaryOn)
                            .frame(width: 46, height: 46)
                            .background(Theme.primary, in: Circle())
                    }
                    .accessibilityLabel("Capture by voice")
                } else {
                Button(action: send) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.primaryOn)
                        .frame(width: 46, height: 46)
                        .background(Theme.primary, in: Circle())
                }
                .disabled(sending || trimmed.isEmpty)
                .opacity(sending || trimmed.isEmpty ? 0.5 : 1)
                .accessibilityLabel("Add")
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 14)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
                .fill(.regularMaterial)
                .overlay {
                    UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
                        .fill(Theme.glassFillStrong)
                }
                .shadow(color: Theme.shadow, radius: 17, y: -6)
                .ignoresSafeArea(edges: .bottom)
        }
        .onAppear { focused = true }
    }

    private func send() {
        let value = text
        guard !trimmed.isEmpty, !sending else { return }
        sending = true
        Task {
            if await onSubmit(value) {
                text = ""
                onClose()
            }
            sending = false
        }
    }
}
