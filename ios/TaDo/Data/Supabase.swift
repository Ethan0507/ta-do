import Foundation
import Supabase

/// Where Supabase sends magic-link and Google sign-ins back to. Must be listed in
/// Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
let authRedirectURL = URL(string: "tado://auth-callback")!

/// Same Supabase project as the web app — same accounts, same RLS. The session is
/// persisted in the Keychain by supabase-swift's default storage.
let supabase = SupabaseClient(
    supabaseURL: URL(string: Secrets.supabaseURL)!,
    supabaseKey: Secrets.supabaseAnonKey,
    options: SupabaseClientOptions(
        auth: .init(
            redirectToURL: authRedirectURL,
            flowType: .pkce,
            // Report the Keychain session immediately (AuthModel checks expiry) instead of
            // waiting on a network refresh — avoids a blank screen on launch.
            emitLocalSessionAsInitialSession: true
        )
    )
)
