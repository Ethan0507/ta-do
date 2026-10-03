import SwiftUI
import Supabase

/// Home — the web Home in native form: glass header, type pill, "completed today" strip,
/// Today list of glass rows with native swipe actions, and a capture "+" button.
struct HomeView: View {
    let user: User
    @State private var model: HomeModel
    @State private var selected: Entry?
    @State private var showSettings = false
    @State private var showCompleted = false
    @State private var capturing = false
    @Environment(\.scenePhase) private var scenePhase

    init(user: User) {
        self.user = user
        _model = State(initialValue: HomeModel(userID: user.id))
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            GlassBackdrop()

            List {
                header
                    .plainRow(top: 8, bottom: 6)

                TypeMenu(selection: $model.type)
                    .plainRow(top: 8, bottom: 8)

                if !model.completed.isEmpty {
                    completedStrip
                        .plainRow(top: 8, bottom: 4)
                }

                Text("TODAY")
                    .font(.system(size: 11.5, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.textMuted)
                    .plainRow(top: 10, bottom: 0)

                if model.loaded && model.entries.isEmpty {
                    emptyState.plainRow(top: 24, bottom: 0)
                }

                ForEach(model.entries) { entry in
                    Button { selected = entry } label: { EntryRow(entry: entry) }
                        .buttonStyle(.plain)
                        .plainRow(top: 6, bottom: 6)
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            if entry.type != .thought {
                                Button {
                                    Task { await model.setDone(entry, true) }
                                } label: {
                                    Label("Done", systemImage: "checkmark")
                                }
                                .tint(Theme.success)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            Button {
                                Task { await model.archive(entry) }
                            } label: {
                                Label("Archive", systemImage: "archivebox")
                            }
                            .tint(.gray)
                        }
                }

                if let error = model.error {
                    Text(error).font(.footnote).foregroundStyle(.red).plainRow(top: 8, bottom: 8)
                }

                // Room so the last row can scroll clear of the + button.
                Color.clear.frame(height: 90).plainRow(top: 0, bottom: 0)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .refreshable { await model.prepareAndLoad() }

            if !capturing {
                CaptureFab { withAnimation(.snappy) { capturing = true } }
                    .padding(.trailing, 20)
                    .padding(.bottom, 12)
                    .transition(.scale.combined(with: .opacity))
            }

            if capturing {
                // Dim Home behind the panel; tap it to close, like the web's scrim.
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture { withAnimation(.snappy) { capturing = false } }
                    .transition(.opacity)
                CapturePanel(type: model.type) { text in
                    await model.capture(text)
                } onClose: {
                    withAnimation(.snappy) { capturing = false }
                }
                .transition(.move(edge: .bottom))
            }
        }
        .foregroundStyle(Theme.text)
        .sensoryFeedback(.success, trigger: model.completed.count)
        .task(id: user.id) { await model.prepareAndLoad() }
        .onChange(of: model.type) { Task { await model.load() } }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.prepareAndLoad() } }
        }
        .sheet(item: $selected) { entry in
            EntryDetailView(entry: entry) { await model.load() }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(user: user, timezone: model.timezone)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Logomark(size: 26)
            Text("Ta-do").font(.display(19))
            Spacer()
            GlassIconButton(systemImage: "gearshape", label: "Settings") { showSettings = true }
        }
    }

    private var completedStrip: some View {
        VStack(spacing: 8) {
            Button {
                withAnimation(.snappy) { showCompleted.toggle() }
            } label: {
                HStack {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 15, weight: .semibold))
                    Text("\(model.completed.count) completed today")
                        .font(.system(size: 13, weight: .bold))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                        .opacity(0.55)
                        .rotationEffect(.degrees(showCompleted ? 180 : 0))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showCompleted {
                ForEach(model.completed) { entry in
                    Button { selected = entry } label: {
                        Text(entry.content)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Theme.textMuted)
                            .strikethrough(color: Theme.textFaint)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Theme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(4)
        .padding(.bottom, showCompleted ? 4 : 0)
        .background(Theme.glassFill, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Text("Today's clear.").font(.system(size: 15, weight: .bold))
            Text(emptyHint).font(.system(size: 13.5)).foregroundStyle(Theme.textMuted)
            Image(systemName: "arrow.down.right")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.primary)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
    }

    private var emptyHint: String {
        switch model.type {
        case .thought: "Capture a thought before it slips —"
        case .task: "No tasks due today."
        case .goal: "No goals in progress."
        }
    }
}

private extension View {
    /// A List row with no system background, separator or default insets — our glass
    /// cards draw their own surface, while List still provides native swipe actions.
    func plainRow(top: CGFloat, bottom: CGFloat) -> some View {
        listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: top, leading: 20, bottom: bottom, trailing: 20))
    }
}
