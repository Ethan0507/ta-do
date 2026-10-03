import SwiftUI

/// Same options as the web RepeatPicker: None / Daily / Weekly / Monthly / Custom, each
/// with one optional time. Switching frequency keeps the time already set.
struct RepeatPicker: View {
    @Binding var rule: RecurrenceRule?
    /// Weekly/monthly default to this date's weekday/day (the web uses the due date or today).
    var referenceDate: Date = Date()

    private static let weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"]

    private var freqSelection: Binding<RecurrenceRule.Freq?> {
        Binding(get: { rule?.freq }, set: { select($0) })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Repeat", selection: freqSelection) {
                Text("None").tag(RecurrenceRule.Freq?.none)
                Text("Daily").tag(RecurrenceRule.Freq?.some(.daily))
                Text("Weekly").tag(RecurrenceRule.Freq?.some(.weekly))
                Text("Monthly").tag(RecurrenceRule.Freq?.some(.monthly))
                Text("Custom").tag(RecurrenceRule.Freq?.some(.custom))
            }
            .pickerStyle(.segmented)

            if let current = rule {
                if current.freq == .weekly {
                    weekdayChips(isSelected: { current.weekday == $0 }) { day in rule?.weekday = day }
                }
                if current.freq == .custom {
                    weekdayChips(isSelected: { current.weekdays?.contains($0) ?? false }) { day in
                        var days = Set(rule?.weekdays ?? [])
                        if days.contains(day) { days.remove(day) } else { days.insert(day) }
                        rule?.weekdays = days.sorted()
                    }
                }
                if current.freq == .monthly, let day = current.dayOfMonth {
                    Text("On day \(day) of each month")
                        .font(.footnote)
                        .foregroundStyle(Theme.textMuted)
                }
                Toggle("Time", isOn: Binding(
                    get: { current.time != nil },
                    set: { rule?.time = $0 ? "09:00" : nil }
                ))
                if let time = current.time {
                    DatePicker("At", selection: Binding(
                        get: { Self.date(from: time) },
                        set: { rule?.time = Self.string(from: $0) }
                    ), displayedComponents: .hourAndMinute)
                }
            }
        }
    }

    private func weekdayChips(isSelected: @escaping (Int) -> Bool, toggle: @escaping (Int) -> Void) -> some View {
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { day in
                Button {
                    toggle(day)
                } label: {
                    Text(Self.weekdayLabels[day])
                        .font(.system(size: 13, weight: .bold))
                        .frame(width: 34, height: 34)
                        .foregroundStyle(isSelected(day) ? Theme.primaryOn : Theme.text)
                        .background(isSelected(day) ? Theme.primary : Theme.field, in: Circle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func select(_ freq: RecurrenceRule.Freq?) {
        guard freq != rule?.freq else { return }
        guard let freq else { rule = nil; return }
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: referenceDate) - 1
        let time = rule?.time
        switch freq {
        case .daily: rule = RecurrenceRule(freq: .daily, time: time)
        case .weekly: rule = RecurrenceRule(freq: .weekly, weekday: weekday, time: time)
        case .monthly: rule = RecurrenceRule(freq: .monthly, dayOfMonth: calendar.component(.day, from: referenceDate), time: time)
        case .custom: rule = RecurrenceRule(freq: .custom, weekdays: [weekday], time: time)
        }
    }

    private static func date(from time: String) -> Date {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: parts.first ?? 9, minute: parts.count > 1 ? parts[1] : 0, second: 0, of: Date()) ?? Date()
    }

    private static func string(from date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

extension RecurrenceRule {
    /// Short description for Library rows, e.g. "Weekdays · 07:00".
    var summary: String {
        let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        var base: String
        switch freq {
        case .daily: base = "Daily"
        case .weekly: base = "Every \(days[weekday ?? 0])"
        case .monthly: base = "Monthly on day \(dayOfMonth ?? 1)"
        case .custom:
            let set = weekdays ?? []
            base = set == [1, 2, 3, 4, 5] ? "Weekdays" : set == [0, 6] ? "Weekends" : set.map { days[$0] }.joined(separator: ", ")
        }
        if let time { base += " · \(time)" }
        return base
    }
}
