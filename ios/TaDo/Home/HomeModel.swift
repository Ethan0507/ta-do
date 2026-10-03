import Foundation
import Observation

@MainActor
@Observable
final class HomeModel {
    let userID: UUID
    var type: EntryType = .thought
    private(set) var entries: [Entry] = []
    private(set) var completed: [Entry] = []
    private(set) var timezone: String?
    /// False until the first load finishes, so the empty state doesn't flash.
    private(set) var loaded = false
    var error: String?

    init(userID: UUID) {
        self.userID = userID
    }

    /// Syncs the timezone and today's repeating tasks, then loads. Run on launch and
    /// whenever the app comes back to the foreground — the day may have changed.
    func prepareAndLoad() async {
        // Show what's there straight away; the day prep (timezone sync + today's repeats)
        // runs alongside and the list refreshes once it lands.
        async let prepared: String? = try? DayService.prepareDay(userID: userID)
        await load()
        if let zone = await prepared {
            timezone = zone
            await load()
        }
    }

    func load() async {
        let type = type
        do {
            async let today = EntryService.fetchToday(type)
            async let done = EntryService.fetchCompletedToday(type)
            let (todayRows, doneRows) = try await (today, done)
            guard type == self.type else { return } // switched while loading
            entries = todayRows
            completed = doneRows
            loaded = true
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// One entry, or — for tasks — one per non-empty line, all landing at the top.
    @discardableResult
    func capture(_ text: String) async -> Bool {
        var lines = [text.trimmingCharacters(in: .whitespacesAndNewlines)]
        if type == .task {
            lines = text.split(whereSeparator: \.isNewline)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
        }
        lines = lines.filter { !$0.isEmpty }
        guard !lines.isEmpty else { return true }

        let top = EntryService.topPosition(above: entries)
        do {
            for (index, line) in lines.enumerated() {
                let position = top - EntryService.positionGap * Double(lines.count - 1 - index)
                try await EntryService.create(userID: userID, type: type, content: line, position: position)
            }
        } catch {
            self.error = error.localizedDescription
            await load()
            return false
        }
        await load()
        return true
    }

    func setDone(_ entry: Entry, _ done: Bool) async {
        if done { entries.removeAll { $0.id == entry.id } }
        do { try await EntryService.setDone(entry, done) } catch { self.error = error.localizedDescription }
        await load()
    }

    func archive(_ entry: Entry) async {
        entries.removeAll { $0.id == entry.id }
        do { try await EntryService.setArchived(entry, true) } catch { self.error = error.localizedDescription }
        await load()
    }
}
