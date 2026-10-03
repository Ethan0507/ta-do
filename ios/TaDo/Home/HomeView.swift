import SwiftUI
import Supabase

/// Home — the web Home in native form: glass header (library, settings), type pill,
/// "completed today" strip, Today list with swipe actions and drag-to-reorder,
/// "Show upcoming tasks", and the capture "+" (hold for voice).
struct HomeView: View {
    let user: User
    @State private var model: HomeModel
    @State private var path: [Route] = []
    @State private var selected: Entry?
    @State private var showSettings = false
    @State private var showCompleted = false
    @State private var showUpcoming = false
    @State private var capturing = false
    @State private var voiceCapturing = false
    @State private var bulkLines: [String]?
    /// Reorder mode shows the list's drag handles (the web shows a handle on every row).
    @State private var editMode: EditMode = .inactive
    @Environment(\.scenePhase) private var scenePhase
    @Environment(AppRouter.self) private var router

    enum Route: Hashable {
        case library(initial: Entry?)
    }

    init(user: User) {
        self.user = user
        _model = State(initialValue: HomeModel(userID: user.id))
    }

    var body: some View {
        NavigationStack(path: $path) {
            home
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .library(let initial):
                        LibraryView(userID: user.id, initialEntry: initial)
                            .onDisappear { Task { await model.load() } }
                    }
                }
        }
        .tint(Theme.primary)
        .sensoryFeedback(.success, trigger: model.completed.count)
        .task(id: user.id) { await model.prepareAndLoad() }
        .onChange(of: model.type) { Task { await model.load() } }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.prepareAndLoad() } }
        }
        .fullScreenCover(isPresented: $voiceCapturing) {
            VoiceCaptureView(initialType: router.voiceCaptureType ?? model.type) { text, type in
                await model.capture(text, as: type)
            } onClose: {
                voiceCapturing = false
                router.voiceCaptureType = nil
            }
        }
        .onChange(of: router.voiceCaptureRequested, initial: true) { _, requested in
            guard requested else { return }
            router.voiceCaptureRequested = false
            selected = nil
            capturing = false
            voiceCapturing = true
        }
        .sheet(item: $selected) { entry in
            EntryDetailView(entry: entry, userID: user.id, onChanged: { await model.load() }, onOpenTemplate: openTemplate)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(user: user) { await model.prepareAndLoad() }
        }
        .sheet(isPresented: $showUpcoming) {
            UpcomingTasksSheet(userID: user.id, onChanged: { await model.load() }, onOpenTemplate: openTemplate)
        }
        .sheet(item: Binding(
            get: { bulkLines.map { BulkLines(lines: $0) } },
            set: { bulkLines = $0?.lines }
        )) { bulk in
            BulkTaskReviewSheet(lines: bulk.lines) { lines in
                await model.capture(lines.joined(separator: "\n"), as: .task)
            }
        }
    }

    private struct BulkLines: Identifiable {
        let id = UUID()
        let lines: [String]
    }

    /// "Edit repeating task": close whatever sheet is open and show the template in Library.
    private func openTemplate(_ template: Entry) {
        selected = nil
        showUpcoming = false
        Task {
            try? await Task.sleep(for: .milliseconds(350)) // let the sheet finish dismissing
            path = [.library(initial: template)]
        }
    }

    private var home: some View {
        ZStack(alignment: .bottomTrailing) {
            GlassBackdrop()

            List {
                header.plainRow(top: 8, bottom: 6)

                TypeMenu(selection: $model.type).plainRow(top: 8, bottom: 8)

                if !model.completed.isEmpty {
                    completedStrip.plainRow(top: 8, bottom: 4)
                }

                HStack {
                    Text("TODAY")
                        .font(.system(size: 11.5, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.textMuted)
                    Spacer()
                    if model.entries.count > 1 {
                        Button(editMode.isEditing ? "Done" : "Reorder") {
                            withAnimation { editMode = editMode.isEditing ? .inactive : .active }
                        }
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.primary)
                        .buttonStyle(.plain)
                    }
                }
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
                .onMove { source, destination in
                    Task { await model.move(from: source, to: destination) }
                }

                if model.type == .task && model.loaded && model.entries.isEmpty {
                    Button("Show upcoming tasks") { showUpcoming = true }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.primary)
                        .frame(maxWidth: .infinity)
                        .buttonStyle(.plain)
                        .plainRow(top: 16, bottom: 0)
                }

                if let error = model.error {
                    Text(error).font(.footnote).foregroundStyle(.red).plainRow(top: 8, bottom: 8)
                }

                // Room so the last row can scroll clear of the + button.
                Color.clear.frame(height: 90).plainRow(top: 0, bottom: 0)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .environment(\.editMode, $editMode)
            .refreshable { await model.prepareAndLoad() }
            .onChange(of: model.type) { editMode = .inactive }

            if !capturing {
                CaptureFab {
                    withAnimation(.snappy) { capturing = true }
                } onLongPress: {
                    voiceCapturing = true
                }
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
                    await submitCapture(text)
                } onClose: {
                    withAnimation(.snappy) { capturing = false }
                } onVoice: {
                    capturing = false
                    voiceCapturing = true
                }
                .transition(.move(edge: .bottom))
            }
        }
        .foregroundStyle(Theme.text)
    }

    /// Several lines in the task box open the review sheet, like the web; otherwise save.
    private func submitCapture(_ text: String) async -> Bool {
        if model.type == .task {
            let lines = text.split(whereSeparator: \.isNewline)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
            if lines.count > 1 {
                bulkLines = lines
                return true
            }
        }
        return await model.capture(text)
    }

    private var header: some View {
        HStack(spacing: 10) {
            Logomark(size: 26)
            Text("Ta-do").font(.display(19))
            Spacer()
            GlassIconButton(systemImage: "calendar", label: "Open library") { path = [.library(initial: nil)] }
            GlassIconButton(systemImage: "gearshape", label: "Account settings") { showSettings = true }
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
