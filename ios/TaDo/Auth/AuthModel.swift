import Foundation
import Observation
import Supabase
import os

private let log = Logger(subsystem: "com.ethanpalani.TaDo", category: "auth")

@MainActor
@Observable
final class AuthModel {
    enum State { case loading, signedOut, signedIn(User) }

    private(set) var state: State = .loading

    init() {
        Task { await listen() }
    }

    private func listen() async {
        for await (event, session) in supabase.auth.authStateChanges {
            log.info("auth event \(String(describing: event), privacy: .public) session=\(session != nil, privacy: .public) expired=\(session?.isExpired ?? false, privacy: .public)")
            if let session, !session.isExpired {
                state = .signedIn(session.user)
            } else if event == .initialSession, session != nil {
                // The saved session's access token has expired (they last an hour). Refresh it
                // rather than showing sign-in; only fall back to sign-in if the refresh fails.
                do {
                    let refreshed = try await supabase.auth.refreshSession()
                    state = .signedIn(refreshed.user)
                } catch {
                    log.error("session refresh failed: \(error.localizedDescription, privacy: .public)")
                    state = .signedOut
                }
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
