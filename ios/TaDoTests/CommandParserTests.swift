import Foundation
import Testing

/// Example sentences → what the voice command parser should understand.
struct CommandParserTests {
    let parser = CommandParser()
    let calendar = Calendar.current

    private func one(_ text: String) throws -> ParsedEntry {
        let entries = parser.parse(text)
        #expect(entries.count == 1, "expected one entry from \"\(text)\", got \(entries.map(\.content))")
        return try #require(entries.first)
    }

    private func day(offset: Int) -> Date {
        calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: Date()))!
    }

    // MARK: Plain capture

    @Test func plainSentenceIsJustContent() throws {
        let e = try one("Buy oat milk and bananas")
        #expect(e.content == "Buy oat milk and bananas")
        #expect(e.type == nil)
        #expect(e.labels.isEmpty && e.dueDate == nil && e.repeatRule == nil)
    }

    @Test func trailingPunctuationIsTrimmed() throws {
        #expect(try one("Call the plumber about the sink.").content == "Call the plumber about the sink")
    }

    // MARK: Type

    @Test func typeWordAtStart() throws {
        let e = try one("Task call the plumber")
        #expect(e.type == .task)
        #expect(e.content == "Call the plumber")
    }

    @Test func goalAtStart() throws {
        let e = try one("New goal run a half marathon")
        #expect(e.type == .goal)
        #expect(e.content == "Run a half marathon")
    }

    @Test func typeWordMidSentenceIsJustAWord() throws {
        let e = try one("Finish the task report")
        #expect(e.type == nil)
        #expect(e.content == "Finish the task report")
    }

    @Test func asATaskAnywhere() throws {
        let e = try one("Renew passport as a task")
        #expect(e.type == .task)
        #expect(e.content == "Renew passport")
    }

    // MARK: Labels

    @Test func labelAs() throws {
        let e = try one("Call mom label as family")
        #expect(e.content == "Call mom")
        #expect(e.labels == ["family"])
    }

    @Test func multipleLabels() throws {
        let e = try one("Plan the trip tag it as travel and family")
        #expect(e.content == "Plan the trip")
        #expect(e.labels == ["travel", "family"])
    }

    @Test func noteAndGiftTagStayAsWords() throws {
        let e = try one("Write a note to Bob about the gift tag")
        #expect(e.content == "Write a note to Bob about the gift tag")
        #expect(e.labels.isEmpty && e.note == nil)
    }

    // MARK: Repeat

    @Test func makeItRepeatingDaily() throws {
        let e = try one("Stretch make it repeating daily")
        #expect(e.content == "Stretch")
        #expect(e.repeatRule == RecurrenceRule(freq: .daily))
        #expect(e.resolvedType(default: .thought) == .task)
    }

    @Test func longestPhraseWinsOverTaskWord() throws {
        let e = try one("Water the plants make it a recurring task every day")
        #expect(e.content == "Water the plants")
        #expect(e.type == nil)
        #expect(e.repeatRule?.freq == .daily)
    }

    @Test func everyWeekdayAtTime() throws {
        let e = try one("Stand-up notes every weekday at 9:30 am")
        #expect(e.content == "Stand-up notes")
        #expect(e.repeatRule == RecurrenceRule(freq: .custom, weekdays: [1, 2, 3, 4, 5], time: "09:30"))
    }

    @Test func everyMonday() throws {
        let e = try one("Take out the bins every Monday")
        #expect(e.content == "Take out the bins")
        #expect(e.repeatRule == RecurrenceRule(freq: .weekly, weekday: 1))
    }

    @Test func severalDays() throws {
        let e = try one("Gym every Monday Wednesday and Friday at 7 am")
        #expect(e.content == "Gym")
        #expect(e.repeatRule == RecurrenceRule(freq: .custom, weekdays: [1, 3, 5], time: "07:00"))
    }

    @Test func monthlyOnDay() throws {
        let e = try one("Pay rent repeat monthly on the 1st")
        #expect(e.content == "Pay rent")
        #expect(e.repeatRule?.freq == .monthly)
        #expect(e.repeatRule?.dayOfMonth == 1)
    }

    @Test func weekendsInTheMorning() throws {
        let e = try one("Long run every weekend in the morning")
        #expect(e.content == "Long run")
        #expect(e.repeatRule == RecurrenceRule(freq: .custom, weekdays: [0, 6], time: "09:00"))
    }

    // MARK: Dates

    @Test func tomorrowAtSix() throws {
        let e = try one("Call mom tomorrow at 6 pm")
        #expect(e.content == "Call mom")
        #expect(e.dueDate == day(offset: 1))
        #expect(e.dueTime == "18:00")
        #expect(e.resolvedType(default: .thought) == .task)
    }

    @Test func dateWithoutTimeHasNoTime() throws {
        let e = try one("Submit the report tomorrow")
        #expect(e.content == "Submit the report")
        #expect(e.dueDate == day(offset: 1))
        #expect(e.dueTime == nil)
    }

    @Test func thoughtKeepsItsDateWords() throws {
        let e = try one("Thought maybe visit Goa tomorrow")
        #expect(e.type == .thought)
        #expect(e.dueDate == nil)
        #expect(e.content == "Maybe visit Goa tomorrow")
    }

    // MARK: Notes

    @Test func withANote() throws {
        let e = try one("Book the dentist with a note ask about whitening")
        #expect(e.content == "Book the dentist")
        #expect(e.note == "ask about whitening")
    }

    // MARK: Everything together

    @Test func fullCommand() throws {
        let e = try one("Call mom tomorrow at 6 pm label as family make it repeating every week")
        #expect(e.content == "Call mom")
        #expect(e.labels == ["family"])
        #expect(e.repeatRule?.freq == .weekly)
        #expect(e.repeatRule?.time == "18:00")
        #expect(e.dueDate == nil)
    }

    // MARK: Several entries

    @Test func nextItemSplits() throws {
        let entries = parser.parse("Task buy milk next item thought learn the guitar next item goal read 20 books")
        #expect(entries.map(\.content) == ["Buy milk", "Learn the guitar", "Read 20 books"])
        #expect(entries.map(\.type) == [.task, .thought, .goal])
    }

    @Test func emptyIsNothing() {
        #expect(parser.parse("   ").isEmpty)
        #expect(parser.parse("next item").isEmpty)
    }

    // MARK: Custom phrases

    @Test func switchedOffDefaultIsIgnored() throws {
        var custom = CommandParser()
        custom.phrases = CommandParser.effectivePhrases(
            disabled: [CommandPhrase(action: .repeating, phrase: "every")],
            custom: [CommandPhrase(action: .repeating, phrase: "on repeat")]
        )
        let plain = try #require(custom.parse("Thank every volunteer").first)
        #expect(plain.repeatRule == nil)
        #expect(plain.content == "Thank every volunteer")
        let repeated = try #require(custom.parse("Stretch on repeat daily").first)
        #expect(repeated.repeatRule?.freq == .daily)
        #expect(repeated.content == "Stretch")
    }

    @Test func customAliasForLabel() throws {
        var custom = CommandParser()
        custom.phrases.append(CommandPhrase(action: .label, phrase: "mark it as"))
        let e = try #require(custom.parse("Fix the bike mark it as weekend").first)
        #expect(e.content == "Fix the bike")
        #expect(e.labels == ["weekend"])
    }
}
