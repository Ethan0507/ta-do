import SwiftUI

/// Every open task regardless of date, grouped Overdue / Today / Tomorrow / date / No due
/// date, loaded 20 at a time — same as the web UpcomingTasksSheet.
struct UpcomingTasksSheet: View {
    @Environment(\.dismiss) private var dismiss
    let userID: UUID
    let onChanged: () async -> Void
    var onOpenTemplate: ((Entry) -> Void)?

    @State private var tasks: [Entry] = []
    @State private var hasMore = true
    @State private var loadingMore = false
    @State private var loaded = false
    @State private var selected: Entry?

    private var groups: [(label: String, items: [Entry])] {
        var result: [(label: String, items: [Entry])] = []
        for task in tasks {
            let label = Self.label(for: task.dueDate)
            if result.last?.label == label { result[result.count - 1].items.append(task) } else { result.append((label, [task])) }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            List {
                if loaded && tasks.isEmpty {
                    Text("No open tasks.").foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity).libraryRow(top: 30, bottom: 0)
                }
                ForEach(groups, id: \.label) { group in
                    Text(group.label.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(group.label == "Overdue" ? Theme.tertiary : Theme.textFaint)
                        .libraryRow(top: 14, bottom: 2)
                    ForEach(group.items) { task in
                        Button { selected = task } label: { EntryRow(entry: task) }
                            .buttonStyle(.plain)
                            .libraryRow(top: 4, bottom: 4)
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    Task { await complete(task) }
                                } label: { Label("Done", systemImage: "checkmark") }
                                .tint(Theme.success)
                            }
                            .onAppear { if task.id == tasks.last?.id { Task { await loadMore() } } }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(GlassBackdrop())
            .navigationTitle("Upcoming tasks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .tint(Theme.primary)
        .presentationDetents([.medium, .large])
        .task { await reload() }
        .sheet(item: $selected) { entry in
            EntryDetailView(entry: entry, userID: userID, onChanged: {
                await reload()
                await onChanged()
            }, onOpenTemplate: onOpenTemplate)
        }
    }

    private func reload() async {
        let page = (try? await EntryService.fetchUpcoming(offset: 0)) ?? []
        tasks = page
        hasMore = page.count == EntryService.upcomingPageSize
        loaded = true
    }

    private func loadMore() async {
        guard hasMore, !loadingMore else { return }
        loadingMore = true
        let page = (try? await EntryService.fetchUpcoming(offset: tasks.count)) ?? []
        tasks += page
        hasMore = page.count == EntryService.upcomingPageSize
        loadingMore = false
    }

    private func complete(_ task: Entry) async {
        tasks.removeAll { $0.id == task.id }
        try? await EntryService.setDone(task, true)
        await onChanged()
    }

    private static func label(for dueDate: String?) -> String {
        guard let dueDate else { return "No due date" }
        let today = AppDay.today()
        if dueDate < today { return "Overdue" }
        if dueDate == today { return "Today" }
        let format = DateFormatter()
        format.dateFormat = "yyyy-MM-dd"
        format.timeZone = AppDay.timeZone
        guard let due = format.date(from: dueDate), let todayDate = format.date(from: today) else { return dueDate }
        let days = Calendar.current.dateComponents([.day], from: todayDate, to: due).day ?? 0
        if days == 1 { return "Tomorrow" }
        let label = DateFormatter()
        label.setLocalizedDateFormatFromTemplate("EEE MMM d")
        label.timeZone = AppDay.timeZone
        return label.string(from: due)
    }
}
