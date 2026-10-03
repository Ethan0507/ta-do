import SwiftUI
import Supabase

/// Account settings — same as the web's sheet: Theme and Timezone. Plus account + sign out.
struct SettingsView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    let user: User
    /// Called after the timezone changes — "today" may now be a different date.
    let onTimezoneChanged: () async -> Void
    @State private var settings = AppSettings.shared
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Group {
                    Section {
                        Picker("Theme", selection: Binding(
                            get: { settings.theme },
                            set: { theme in Task { await settings.setTheme(theme, userID: user.id) } }
                        )) {
                            ForEach(ThemePreference.allCases) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text("Theme")
                    } footer: {
                        Text("Auto follows your iPhone's light/dark setting.")
                    }

                    Section {
                        Toggle("Use device timezone", isOn: Binding(
                            get: { settings.timezoneAuto },
                            set: { auto in saveTimezone(auto: auto, zone: settings.timezone) }
                        ))
                        if settings.timezoneAuto {
                            LabeledContent("Timezone", value: settings.timezone)
                        } else {
                            NavigationLink {
                                TimezonePicker(selection: settings.timezone) { zone in
                                    saveTimezone(auto: false, zone: zone)
                                }
                            } label: {
                                LabeledContent("Timezone", value: settings.timezone)
                            }
                        }
                    } header: {
                        Text("Timezone")
                    } footer: {
                        Text("Decides when your day starts — repeating tasks are created at midnight in this timezone.")
                    }

                    Section("Account") {
                        Text(user.email ?? user.id.uuidString)
                        Button("Sign out", role: .destructive) {
                            Task { await auth.signOut() }
                        }
                    }

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }
                .listRowBackground(Theme.glassFillStrong)
            }
            .scrollContentBackground(.hidden)
            .background(GlassBackdrop())
            .tint(Theme.primary)
            .navigationTitle("Account settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func saveTimezone(auto: Bool, zone: String) {
        Task {
            do {
                try await settings.setTimezone(auto: auto, zone: zone, userID: user.id)
                error = nil
                await onTimezoneChanged()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

private struct TimezonePicker: View {
    @Environment(\.dismiss) private var dismiss
    let selection: String
    let onPick: (String) -> Void
    @State private var search = ""

    private var zones: [String] {
        let all = TimeZone.knownTimeZoneIdentifiers.sorted()
        return search.isEmpty ? all : all.filter { $0.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        List(zones, id: \.self) { zone in
            Button {
                onPick(zone)
                dismiss()
            } label: {
                HStack {
                    Text(zone.replacingOccurrences(of: "_", with: " "))
                    Spacer()
                    if zone == selection { Image(systemName: "checkmark").foregroundStyle(Theme.primary) }
                }
            }
            .tint(Theme.text)
            .listRowBackground(Theme.glassFillStrong)
        }
        .scrollContentBackground(.hidden)
        .background(GlassBackdrop())
        .searchable(text: $search)
        .navigationTitle("Timezone")
    }
}
