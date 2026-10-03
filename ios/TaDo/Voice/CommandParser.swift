import Foundation

/// One entry understood from a voice capture, before it's saved.
struct ParsedEntry: Identifiable, Equatable {
    let id = UUID()
    var content: String
    /// Explicitly said ("task …", "as a goal"); nil = decide from context.
    var type: EntryType?
    var labels: [String] = []
    var dueDate: Date?
    var dueTime: String?        // "HH:MM"
    var repeatRule: RecurrenceRule?
    var note: String?

    /// A due date or repeat only makes sense on a task, so they imply one.
    func resolvedType(default fallback: EntryType) -> EntryType {
        if let type { return type }
        return dueDate != nil || repeatRule != nil ? .task : fallback
    }

    static func == (a: ParsedEntry, b: ParsedEntry) -> Bool {
        a.content == b.content && a.type == b.type && a.labels == b.labels && a.dueDate == b.dueDate
            && a.dueTime == b.dueTime && a.repeatRule == b.repeatRule && a.note == b.note
    }
}

/// What a trigger phrase does.
enum CommandAction: String, Codable, CaseIterable, Identifiable {
    case task, thought, goal, label, repeating, due, note, next
    var id: String { rawValue }
}

struct CommandPhrase: Hashable, Codable {
    let action: CommandAction
    let phrase: String
}

/// Rule-based voice commands — see docs/checklist.md Phase 2.5. Text before the first
/// trigger phrase is the entry; each phrase takes the words up to the next phrase; the
/// longest phrase wins where they overlap. Runs on-device, no network.
struct CommandParser {
    var phrases: [CommandPhrase] = CommandParser.defaultPhrases
    var calendar: Calendar = .current
    var now: () -> Date = Date.init

    static let defaultPhrases: [CommandPhrase] = {
        func p(_ action: CommandAction, _ list: [String]) -> [CommandPhrase] { list.map { CommandPhrase(action: action, phrase: $0) } }
        return p(.task, ["new task", "add a task", "add task", "task", "as a task", "make it a task"])
            + p(.thought, ["new thought", "thought", "note to self", "as a thought", "make it a thought"])
            + p(.goal, ["new goal", "add a goal", "goal", "as a goal", "make it a goal"])
            + p(.label, ["label as", "label it as", "label it", "labelled as", "labeled as", "tag as", "tag it as", "tag it", "category"])
            + p(.repeating, ["make it repeating", "make it recurring", "make it a recurring task", "make it a repeating task", "repeating", "recurring", "repeat", "repeats", "every"])
            + p(.due, ["due on", "due by", "due"])
            + p(.note, ["with a note", "with note", "add a note"])
            + p(.next, ["next item", "new item", "and then"])
    }()

    /// The phrases to use: defaults minus any the user switched off, plus their own.
    static func effectivePhrases(disabled: [CommandPhrase], custom: [CommandPhrase]) -> [CommandPhrase] {
        func key(_ p: CommandPhrase) -> String { "\(p.action.rawValue)|\(p.phrase.lowercased())" }
        let off = Set(disabled.map(key))
        return defaultPhrases.filter { !off.contains(key($0)) } + custom
    }

    private struct Match {
        let action: CommandAction
        let range: Range<String.Index>
        let phrase: String
    }

    /// Bare type words only count at the start ("task call mom"); mid-sentence they're
    /// just words ("finish the task report"). "as a task" etc. work anywhere.
    private static let startOnly: Set<String> = ["task", "thought", "goal"]

    func parse(_ transcript: String) -> [ParsedEntry] {
        let text = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return [] }

        // Split into separate entries on "next item" / "and then".
        var segments: [Substring] = []
        var cursor = text.startIndex
        for match in findMatches(in: text) where match.action == .next {
            segments.append(text[cursor..<match.range.lowerBound])
            cursor = match.range.upperBound
        }
        segments.append(text[cursor...])

        return segments.compactMap { parseSegment(String($0)) }
    }

    // MARK: Segments

    private func parseSegment(_ segment: String) -> ParsedEntry? {
        let text = segment.trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
        guard !text.isEmpty else { return nil }
        let matches = findMatches(in: text).filter { match in
            guard match.action != .next else { return false }
            guard Self.startOnly.contains(match.phrase.lowercased()) else { return true }
            return text[text.startIndex..<match.range.lowerBound].trimmingCharacters(in: .whitespaces).isEmpty
        }

        var entry = ParsedEntry(content: "")
        var contentParts: [String] = []
        if let first = matches.first {
            contentParts.append(String(text[text.startIndex..<first.range.lowerBound]))
        } else {
            contentParts.append(text)
        }

        for (index, match) in matches.enumerated() {
            let end = index + 1 < matches.count ? matches[index + 1].range.lowerBound : text.endIndex
            let argument = String(text[match.range.upperBound..<end])
            let phraseText = String(text[match.range]).lowercased()
            switch match.action {
            case .task, .thought, .goal:
                entry.type = EntryType(rawValue: match.action.rawValue)
                contentParts.append(argument) // the entry continues after a type word
            case .label:
                entry.labels += Self.splitList(argument)
            case .repeating:
                // "every monday" — the trigger word is part of the rule.
                let ruleText = phraseText == "every" ? "every " + argument : argument
                let (rule, leftover) = parseRepeat(ruleText)
                entry.repeatRule = rule
                if !leftover.isEmpty { contentParts.append(leftover) }
            case .due:
                if let found = detectDate(in: argument) {
                    entry.dueDate = found.date
                    entry.dueTime = found.time
                    contentParts.append(found.remainder)
                } else {
                    contentParts.append(argument)
                }
            case .note:
                entry.note = Self.clean(argument)
            case .next:
                break
            }
        }

        var content = Self.clean(contentParts.joined(separator: " "))

        // A date said anywhere in the sentence ("call mom tomorrow at 6") — unless it's
        // explicitly a thought or goal, where a date wouldn't be used.
        if entry.dueDate == nil, entry.type == nil || entry.type == .task,
           let found = detectDate(in: content) {
            content = Self.clean(found.remainder)
            if entry.repeatRule != nil {
                // A repeating task's template has no due date; a time said with it is
                // when each day's task is due.
                if entry.repeatRule?.time == nil { entry.repeatRule?.time = found.time }
            } else {
                entry.dueDate = found.date
                entry.dueTime = found.time
            }
        }

        // Text after a command word starts lowercase ("task call mom") — capitalise it.
        entry.content = content.prefix(1).uppercased() + content.dropFirst()
        guard !entry.content.isEmpty else { return nil }
        return entry
    }

    // MARK: Phrase matching

    private func findMatches(in text: String) -> [Match] {
        var taken: [Range<String.Index>] = []
        var matches: [Match] = []
        let ordered = phrases
            .filter { !$0.phrase.trimmingCharacters(in: .whitespaces).isEmpty }
            .sorted { $0.phrase.count > $1.phrase.count }
        for phrase in ordered {
            let pattern = "\\b" + NSRegularExpression.escapedPattern(for: phrase.phrase.trimmingCharacters(in: .whitespaces)) + "\\b"
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            for result in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
                guard let range = Range(result.range, in: text),
                      !taken.contains(where: { $0.overlaps(range) }) else { continue }
                taken.append(range)
                matches.append(Match(action: phrase.action, range: range, phrase: phrase.phrase))
            }
        }
        return matches.sorted { $0.range.lowerBound < $1.range.lowerBound }
    }

    // MARK: Repeat rules

    private static let weekdays: [(names: [String], day: Int)] = [
        (["sunday", "sundays", "sun"], 0), (["monday", "mondays", "mon"], 1), (["tuesday", "tuesdays", "tue", "tues"], 2),
        (["wednesday", "wednesdays", "wed"], 3), (["thursday", "thursdays", "thu", "thurs"], 4),
        (["friday", "fridays", "fri"], 5), (["saturday", "saturdays", "sat"], 6),
    ]

    /// "every weekday at 7 am" → custom Mon–Fri 07:00. Returns words it didn't use.
    func parseRepeat(_ raw: String) -> (RecurrenceRule, String) {
        var text = " " + raw.lowercased() + " "
        let today = now()
        let todayWeekday = calendar.component(.weekday, from: today) - 1

        var time: String?
        if let found = Self.extractTime(from: &text) { time = found }

        func consume(_ words: [String]) -> Bool {
            var hit = false
            for word in words {
                if let regex = try? NSRegularExpression(pattern: "\\b\(word)\\b"),
                   regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil {
                    text = regex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: " ")
                    hit = true
                }
            }
            return hit
        }

        var rule: RecurrenceRule
        if consume(["weekdays", "weekday", "work days", "workdays"]) {
            rule = RecurrenceRule(freq: .custom, weekdays: [1, 2, 3, 4, 5])
        } else if consume(["weekends", "weekend"]) {
            rule = RecurrenceRule(freq: .custom, weekdays: [0, 6])
        } else {
            let days = Self.weekdays.filter { consume($0.names) }.map(\.day).sorted()
            if days.count == 1 {
                rule = RecurrenceRule(freq: .weekly, weekday: days[0])
            } else if days.count > 1 {
                rule = RecurrenceRule(freq: .custom, weekdays: days)
            } else if consume(["monthly", "every month", "month", "months"]) {
                var day = calendar.component(.day, from: today)
                if let regex = try? NSRegularExpression(pattern: "\\b(\\d{1,2})(st|nd|rd|th)?\\b"),
                   let m = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                   let r = Range(m.range(at: 1), in: text), let n = Int(text[r]), (1...31).contains(n) {
                    day = n
                    text = regex.stringByReplacingMatches(in: text, range: m.range, withTemplate: " ")
                }
                rule = RecurrenceRule(freq: .monthly, dayOfMonth: day)
            } else if consume(["weekly", "every week", "week", "weeks"]) {
                rule = RecurrenceRule(freq: .weekly, weekday: todayWeekday)
            } else {
                _ = consume(["daily", "every day", "each day", "day", "days"])
                rule = RecurrenceRule(freq: .daily)
            }
        }
        rule.time = time

        // Filler around the rule ("every", "on", "the", "and") isn't part of the entry.
        _ = consume(["every", "each", "on", "the", "and", "at", "of", "a", "it", "is"])
        return (rule, Self.clean(text))
    }

    /// Pulls a time ("at 7", "7 am", "18:30", "in the morning") out of the text.
    static func extractTime(from text: inout String) -> String? {
        let patterns: [(String, (NSTextCheckingResult, String) -> String?)] = [
            ("\\b(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)", { m, s in Self.time(m, s, meridiemGroup: 3) }),
            ("\\b(?:at\\s+)?(\\d{1,2}):(\\d{2})\\b", { m, s in Self.time(m, s, meridiemGroup: nil) }),
            ("\\bat\\s+(\\d{1,2})\\b(?!\\s*(?:st|nd|rd|th))", { m, s in Self.time(m, s, meridiemGroup: nil) }),
            ("\\b(?:in the )?morning\\b", { _, _ in "09:00" }),
            ("\\b(?:in the )?afternoon\\b", { _, _ in "14:00" }),
            ("\\b(?:in the )?evening\\b", { _, _ in "18:00" }),
            ("\\b(?:at )?night\\b", { _, _ in "21:00" }),
            ("\\bnoon\\b", { _, _ in "12:00" }),
        ]
        for (pattern, read) in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                  let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let value = read(match, text) else { continue }
            text = regex.stringByReplacingMatches(in: text, range: match.range, withTemplate: " ")
            return value
        }
        return nil
    }

    private static func time(_ m: NSTextCheckingResult, _ s: String, meridiemGroup: Int?) -> String? {
        func group(_ i: Int) -> String? {
            guard m.range(at: i).location != NSNotFound, let r = Range(m.range(at: i), in: s) else { return nil }
            return String(s[r])
        }
        guard var hour = group(1).flatMap(Int.init) else { return nil }
        let minute = group(2).flatMap(Int.init) ?? 0
        if let g = meridiemGroup, let meridiem = group(g)?.lowercased() {
            if meridiem.hasPrefix("p"), hour < 12 { hour += 12 }
            if meridiem.hasPrefix("a"), hour == 12 { hour = 0 }
        }
        guard (0...23).contains(hour), (0...59).contains(minute) else { return nil }
        return String(format: "%02d:%02d", hour, minute)
    }

    // MARK: Dates

    struct FoundDate { let date: Date; let time: String?; let remainder: String }

    /// Finds a date/time phrase ("tomorrow at 6 pm", "next friday", "on the 12th").
    func detectDate(in text: String) -> FoundDate? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue),
              let match = detector.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let date = match.date,
              let range = Range(match.range, in: text) else { return nil }

        // The detector gives date-only phrases a default time, so only keep a time that
        // was actually said.
        var matched = String(text[range])
        let time = Self.extractTime(from: &matched)

        // Drop a dangling preposition left where the date was ("call mom on").
        let prefix = String(text[..<range.lowerBound])
            .replacingOccurrences(of: "\\b(on|by|at|for|due)\\s*$", with: "", options: [.regularExpression, .caseInsensitive])
        let suffix = String(text[range.upperBound...])
        return FoundDate(date: calendar.startOfDay(for: date), time: time, remainder: Self.clean(prefix + " " + suffix))
    }

    // MARK: Text helpers

    /// "family and work, health" → ["family", "work", "health"]
    static func splitList(_ text: String) -> [String] {
        text.replacingOccurrences(of: "&", with: ",")
            .replacingOccurrences(of: " and ", with: ",", options: .caseInsensitive)
            .split(separator: ",")
            .map { clean(String($0)).replacingOccurrences(of: "^(as|it|to|with)\\s+", with: "", options: [.regularExpression, .caseInsensitive]) }
            .map(clean)
            .filter { !$0.isEmpty }
    }

    /// Trims whitespace, stray punctuation and connector words left at either end.
    static func clean(_ text: String) -> String {
        var s = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        let junk = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ",.;:-–—!?"))
        let connectors = ["and", "then", "also", "please", "with", "to", "it", "as", "a"]
        var changed = true
        while changed {
            changed = false
            s = s.trimmingCharacters(in: junk)
            for word in connectors {
                if s.lowercased().hasSuffix(" " + word) {
                    s = String(s.dropLast(word.count + 1)); changed = true
                }
                if s.lowercased() == word { s = ""; changed = true }
            }
        }
        return s
    }
}
