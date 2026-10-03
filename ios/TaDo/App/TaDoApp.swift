import SwiftUI

@main
struct TaDoApp: App {
    @State private var auth = AuthModel()
    @State private var router = AppRouter.shared
    @State private var settings = AppSettings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(router)
                // The web app's primary purple, oklch(58% 0.16 290).
                .tint(Color(red: 0.49, green: 0.37, blue: 0.84))
                .preferredColorScheme(settings.theme.colorScheme)
                .onOpenURL { url in
                    if !router.handle(url) {
                        Task { await auth.handle(url: url) }
                    }
                }
        }
    }
}

struct RootView: View {
    @Environment(AuthModel.self) private var auth

    var body: some View {
        switch auth.state {
        case .loading:
            ZStack {
                GlassBackdrop()
                Logomark(size: 56)
            }
        case .signedOut:
            LoginView()
        case .signedIn(let user):
            HomeView(user: user)
        }
    }
}
