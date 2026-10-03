import SwiftUI

/// A glass row like the web DailyRow: marker, title, due/overdue line, repeat icon.
struct EntryRow: View {
    let entry: Entry

    var body: some View {
        HStack(spacing: 12) {
            marker
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.content)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(entry.isDone ? Theme.textMuted : Theme.text)
                    .strikethrough(entry.isDone, color: Theme.textFaint)
                    .multilineTextAlignment(.leading)
                if let detail { detail }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
        .contentShape(Rectangle())
    }

    @ViewBuilder private var marker: some View {
        switch entry.type {
        case .thought:
            Circle().fill(Theme.primary).frame(width: 8, height: 8).padding(.horizontal, 6.5)
        case .task, .goal:
            if entry.isDone {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Theme.primaryOn)
                    .frame(width: 21, height: 21)
                    .background(Theme.success, in: Circle())
            } else {
                Circle().strokeBorder(Theme.tertiary, lineWidth: 2).frame(width: 21, height: 21)
            }
        }
    }

    /// Same rules as the web DailyRow.
    private var detail: Text? {
        var parts: [Text] = []
        let today = AppDay.today()
        if entry.type == .task, let due = entry.dueDate {
            let time = entry.dueTime.map { String($0.prefix(5)) }
            if due < today {
                parts.append(Text("Overdue · \(due)").foregroundStyle(Theme.tertiary).bold())
            } else if due == today {
                if let time { parts.append(Text("Due \(time)")) }
            } else {
                parts.append(Text("Due \(due)" + (time.map { " \($0)" } ?? "")))
            }
        }
        if entry.habitID != nil {
            parts.append(Text(Image(systemName: "repeat")))
        }
        guard !parts.isEmpty else { return nil }
        return parts.dropFirst()
            .reduce(parts[0]) { $0 + Text("  ") + $1 }
            .font(.system(size: 12))
            .foregroundStyle(Theme.textMuted)
    }
}
