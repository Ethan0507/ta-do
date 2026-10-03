import SwiftUI

/// Library — same as the web Library: every entry except generated tasks (templates stand
/// in for their series), filterable by type, sorted by category or newest, archived toggle.
struct LibraryView: View {
    let userID: UUID
    /// Opened on arrival, e.g. a template reached via "Edit repeating task" on Home.
    var initialEntry: Entry?

    enum Sort: String, CaseIterable, Identifiable {
        case category = "Category, A–Z"
        case newest = "Newest first"
        var id: String { rawValue }
    }

    @State private var entries: [Entry] = []
    @State private var categories: [Category] = []
    @State private var entryCategoryIDs: [UUID: [UUID]] = [:]
    @State private var showArchived = false
    @State private var typeFilter: EntryType?
    @State private var sort: Sort = .category
    @State private var selected: Entry?
    @State private var loaded = false
    @State private var openedInitial = false

    private struct Group: Identifiable {
        let id: String
        let name: String?
        let entries: [Entry]
    }

    private var filtered: [Entry] {
        typeFilter.map { type in entries.filter { $0.type == type } } ?? entries
    }

    private var groups: [Group] {
        if sort == .newest {
            return [Group(id: "all", name: nil, entries: filtered)]
        }
        var byCategory: [UUID: [Entry]] = [:]
        var uncategorized: [Entry] = []
        for entry in filtered {
            let ids = entryCategoryIDs[entry.id] ?? []
            if ids.isEmpty { uncategorized.append(entry) }
            for id in ids { byCategory[id, default: []].append(entry) }
        }
        var result = categories
            .filter { byCategory[$0.id] != nil }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            .map { Group(id: $0.id.uuidString, name: $0.name, entries: byCategory[$0.id]!) }
        if !uncategorized.isEmpty { result.append(Group(id: "uncategorized", name: "Uncategorized", entries: uncategorized)) }
        return result
    }

    var body: some View {
        ZStack {
            GlassBackdrop()
            List {
                controls.libraryRow(top: 4, bottom: 10)

                ForEach(groups) { group in
                    if let name = group.name {
                        HStack(spacing: 8) {
                            Text(name).font(.system(size: 14, weight: .bold))
                                .foregroundStyle(group.id == "uncategorized" ? Theme.textMuted : Theme.text)
                            Text("\(group.entries.count)").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textFaint)
                        }
                        .libraryRow(top: 14, bottom: 4)
                    }
                    ForEach(group.entries) { entry in
                        Button { selected = entry } label: { LibraryRow(entry: entry) }
                            .buttonStyle(.plain)
                            .libraryRow(top: 4, bottom: 4)
                    }
                }

                if loaded && groups.allSatisfy({ $0.entries.isEmpty }) {
                    Text("Nothing here yet.")
                        .foregroundStyle(Theme.textMuted)
                        .frame(maxWidth: .infinity)
                        .libraryRow(top: 30, bottom: 0)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .refreshable { await reload() }
        }
        .foregroundStyle(Theme.text)
        .navigationTitle("Library")
        .navigationBarTitleDisplayMode(.inline)
        // Home hides the bar for its custom header; make sure it's back here however
        // Library was reached (header button or "Edit repeating task").
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            // Explicit title item: the plain navigation title vanished after a sheet opened
            // straight on arrival (the "Edit repeating task" path) was dismissed.
            ToolbarItem(placement: .principal) {
                Text("Library").font(.headline)
            }
        }
        .task(id: showArchived) { await reload() }
        .sheet(item: $selected) { entry in
            EntryDetailView(entry: entry, userID: userID) { await reload() }
        }
    }

    private var controls: some View {
        HStack(spacing: 8) {
            Menu {
                Picker("Type", selection: $typeFilter) {
                    Text("All types").tag(EntryType?.none)
                    ForEach(EntryType.allCases) { Label($0.plural, systemImage: $0.symbol).tag(EntryType?.some($0)) }
                }
            } label: {
                chip(typeFilter?.plural ?? "All types")
            }
            Menu {
                Picker("Sort", selection: $sort) {
                    ForEach(Sort.allCases) { Text($0.rawValue).tag($0) }
                }
            } label: {
                chip(sort.rawValue)
            }
            Spacer()
            Toggle("Archived", isOn: $showArchived)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .fixedSize()
                .tint(Theme.primary)
        }
    }

    private func chip(_ title: String) -> some View {
        HStack(spacing: 5) {
            Text(title).font(.system(size: 12.5, weight: .semibold)).lineLimit(1)
            Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.textFaint)
        }
        .foregroundStyle(Theme.text)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .glassCard(cornerRadius: 16)
        .fixedSize()
    }

    private func reload() async {
        async let rows = try? EntryService.fetchLibrary(includeArchived: showArchived)
        async let cats = try? CategoryService.fetchAll()
        async let links = try? CategoryService.fetchEntryCategoryIDs()
        entries = await rows ?? []
        categories = await cats ?? []
        entryCategoryIDs = await links ?? [:]
        loaded = true
        if !openedInitial, let initialEntry {
            openedInitial = true
            selected = entries.first { $0.id == initialEntry.id } ?? initialEntry
        }
    }
}

private struct LibraryRow: View {
    let entry: Entry

    var body: some View {
        HStack(spacing: 12) {
            marker
            Text(entry.content)
                .font(.system(size: 14.5))
                .strikethrough(entry.type == .task && entry.isDone, color: Theme.textFaint)
                .opacity(entry.type == .task && entry.isDone ? 0.6 : 1)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(cornerRadius: 16)
        .opacity(entry.archivedAt == nil ? 1 : 0.55)
        .contentShape(Rectangle())
    }

    @ViewBuilder private var marker: some View {
        if entry.type == .thought {
            Circle().fill(Theme.primary).frame(width: 8, height: 8).padding(.horizontal, 5.5)
        } else if entry.isRecurrenceTemplate {
            Image(systemName: "repeat")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.primary)
                .frame(width: 19, height: 19)
                .accessibilityLabel("Repeating task")
        } else if entry.isDone {
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(Theme.primaryOn)
                .frame(width: 19, height: 19)
                .background(Theme.success, in: Circle())
        } else {
            Circle().strokeBorder(Theme.tertiary, lineWidth: 2).frame(width: 19, height: 19)
        }
    }
}

extension View {
    func libraryRow(top: CGFloat, bottom: CGFloat) -> some View {
        listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: top, leading: 20, bottom: bottom, trailing: 20))
    }
}
