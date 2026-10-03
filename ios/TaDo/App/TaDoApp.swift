import SwiftUI

@main
struct TaDoApp: App {
    @State private var auth = AuthModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                // The web app's primary purple, oklch(58% 0.16 290).
                .tint(Color(red: 0.49, green: 0.37, blue: 0.84))
                .onOpenURL { url in
                    Task { await auth.handle(url: url) }
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
