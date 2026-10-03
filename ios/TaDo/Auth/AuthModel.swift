import Foundation
import Observation
import Supabase

@MainActor
@Observable
final class AuthModel {
    enum State { case loading, signedOut, signedIn(User) }

    private(set) var state: State = .loading

    init() {
        Task { await listen() }
    }

    private func listen() async {
        for await (_, session) in supabase.auth.authStateChanges {
            if let session, !session.isExpired {
                state = .signedIn(session.user)
            } else {
                state = .signedOut
            }
        }
    }

    func sendMagicLink(to email: String) async throws {
        try await supabase.auth.signInWithOTP(email: email, redirectTo: authRedirectURL)
    }

    func signInWithGoogle() async throws {
        try await supabase.auth.signInWithOAuth(provider: .google, redirectTo: authRedirectURL)
    }

    /// Completes a magic-link sign-in when the email link opens the app.
    func handle(url: URL) async {
        do {
            try await supabase.auth.session(from: url)
        } catch {
            print("Sign-in callback failed: \(error)")
        }
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }
}
