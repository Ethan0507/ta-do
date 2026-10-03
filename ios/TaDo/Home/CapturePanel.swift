import SwiftUI

/// The web's round purple "+" button.
struct CaptureFab: View {
    let action: () -> Void

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
        .accessibilityLabel("Capture")
    }
}

/// The capture panel — like the web's capture form: a glass panel pinned to the
/// bottom that rides on top of the keyboard, over a dimmed Home.
struct CapturePanel: View {
    let type: EntryType
    /// Returns false if saving failed.
    let onSubmit: (String) async -> Bool
    let onClose: () -> Void
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
                // Tasks: several lines become several tasks. Others submit on Return.
                TextField(
                    type == .task ? "What's on your mind? One task per line to add several at once." : "What's on your mind?",
                    text: $text,
                    axis: .vertical
                )
                .lineLimit(1...(type == .task ? 6 : 4))
                .font(.system(size: 16))
                .focused($focused)
                .submitLabel(type == .task ? .return : .send)
                .onSubmit { if type != .task { send() } }
                .padding(.horizontal, 18)
                .padding(.vertical, 15)
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Theme.primary, lineWidth: 1.5)
                }

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
