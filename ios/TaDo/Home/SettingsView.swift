import SwiftUI
import Supabase

/// Account settings for now: who's signed in, the account timezone, sign out.
/// Theme follows the system on iOS; changing the timezone happens on the web for now.
struct SettingsView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    let user: User
    let timezone: String?

    var body: some View {
        NavigationStack {
            List {
                Group {
                Section("Account") {
                    Text(user.email ?? user.id.uuidString)
                    LabeledContent("Timezone", value: timezone ?? "…")
                }
                Section {
                    Button("Sign out", role: .destructive) {
                        Task { await auth.signOut() }
                    }
                }
                }
                .listRowBackground(Theme.glassFillStrong)
            }
            .scrollContentBackground(.hidden)
            .background(GlassBackdrop())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
