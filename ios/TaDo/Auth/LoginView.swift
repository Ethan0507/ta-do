import SwiftUI

/// Sign-in, styled like the web Login: a glass card on the purple backdrop.
struct LoginView: View {
    @Environment(AuthModel.self) private var auth
    @State private var email = ""
    @State private var sentTo: String?
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ZStack {
            GlassBackdrop()

            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 10) {
                    Logomark(size: 30)
                    Text("Ta-do").font(.display(22))
                }
                Text("Enter your email and we'll send a sign-in link.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textMuted)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Email").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMuted)
                    TextField("you@example.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)
                        .background(Theme.field, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Theme.glassBorder)
                        }
                }

                Button {
                    run {
                        try await auth.sendMagicLink(to: email.trimmingCharacters(in: .whitespaces))
                        sentTo = email
                    }
                } label: {
                    Text("Send sign-in link")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(Theme.primaryOn)
                        .background(Theme.primary, in: Capsule())
                }
                .disabled(busy || !email.contains("@"))
                .opacity(busy || !email.contains("@") ? 0.6 : 1)

                HStack {
                    Rectangle().fill(Theme.glassBorder).frame(height: 1)
                    Text("or").font(.system(size: 12)).foregroundStyle(Theme.textFaint)
                    Rectangle().fill(Theme.glassBorder).frame(height: 1)
                }

                Button {
                    run { try await auth.signInWithGoogle() }
                } label: {
                    Label("Continue with Google", systemImage: "g.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(Theme.text)
                        .background(Theme.field, in: Capsule())
                        .overlay { Capsule().strokeBorder(Theme.glassBorder) }
                }
                .disabled(busy)

                if let sentTo {
                    Text("Check \(sentTo) — open the link on this phone.")
                        .font(.footnote)
                        .foregroundStyle(Theme.textMuted)
                }
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            .padding(22)
            .glassCard(cornerRadius: 24, strong: true)
            .padding(.horizontal, 20)
        }
        .foregroundStyle(Theme.text)
        .tint(Theme.primary)
    }

    private func run(_ action: @escaping () async throws -> Void) {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do { try await action() } catch { self.error = error.localizedDescription }
        }
    }
}
