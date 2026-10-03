// Mirrors ios/TaDoTests/CommandParserTests.swift — the same sentences must read the same way
// on web and iOS. Add a case to both when changing the rules.
import { describe, expect, it } from 'vitest'
import { effectivePhrases, parseCommands, resolvedType, type CommandPhrase } from './parser'

const pad = (n: number) => String(n).padStart(2, '0')
function day(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function one(text: string, phrases?: CommandPhrase[]) {
  const entries = parseCommands(text, phrases)
  expect(entries, `one entry from "${text}"`).toHaveLength(1)
  return entries[0]
}

describe('plain capture', () => {
  it('plain sentence is just content', () => {
    const e = one('Buy oat milk and bananas')
    expect(e.content).toBe('Buy oat milk and bananas')
    expect(e.type).toBeNull()
    expect(e.labels).toEqual([])
    expect(e.dueDate).toBeNull()
    expect(e.repeatRule).toBeNull()
  })
  it('trailing punctuation is trimmed', () => {
    expect(one('Call the plumber about the sink.').content).toBe('Call the plumber about the sink')
  })
})

describe('type', () => {
  it('type word at start', () => {
    const e = one('Task call the plumber')
    expect(e.type).toBe('task')
    expect(e.content).toBe('Call the plumber')
  })
  it('goal at start', () => {
    const e = one('New goal run a half marathon')
    expect(e.type).toBe('goal')
    expect(e.content).toBe('Run a half marathon')
  })
  it('type word mid-sentence is just a word', () => {
    const e = one('Finish the task report')
    expect(e.type).toBeNull()
    expect(e.content).toBe('Finish the task report')
  })
  it('"as a task" anywhere', () => {
    const e = one('Renew passport as a task')
    expect(e.type).toBe('task')
    expect(e.content).toBe('Renew passport')
  })
})

describe('labels', () => {
  it('label as', () => {
    const e = one('Call mom label as family')
    expect(e.content).toBe('Call mom')
    expect(e.labels).toEqual(['family'])
  })
  it('multiple labels', () => {
    const e = one('Plan the trip tag it as travel and family')
    expect(e.content).toBe('Plan the trip')
    expect(e.labels).toEqual(['travel', 'family'])
  })
  it('"note" and "gift tag" stay as words', () => {
    const e = one('Write a note to Bob about the gift tag')
    expect(e.content).toBe('Write a note to Bob about the gift tag')
    expect(e.labels).toEqual([])
    expect(e.note).toBeNull()
  })
})

describe('repeat', () => {
  it('make it repeating daily', () => {
    const e = one('Stretch make it repeating daily')
    expect(e.content).toBe('Stretch')
    expect(e.repeatRule).toEqual({ freq: 'daily' })
    expect(resolvedType(e, 'thought')).toBe('task')
  })
  it('longest phrase wins over "task"', () => {
    const e = one('Water the plants make it a recurring task every day')
    expect(e.content).toBe('Water the plants')
    expect(e.type).toBeNull()
    expect(e.repeatRule?.freq).toBe('daily')
  })
  it('every weekday at a time', () => {
    const e = one('Stand-up notes every weekday at 9:30 am')
    expect(e.content).toBe('Stand-up notes')
    expect(e.repeatRule).toEqual({ freq: 'custom', weekdays: [1, 2, 3, 4, 5], time: '09:30' })
  })
  it('every Monday', () => {
    const e = one('Take out the bins every Monday')
    expect(e.content).toBe('Take out the bins')
    expect(e.repeatRule).toEqual({ freq: 'weekly', weekday: 1 })
  })
  it('several days', () => {
    const e = one('Gym every Monday Wednesday and Friday at 7 am')
    expect(e.content).toBe('Gym')
    expect(e.repeatRule).toEqual({ freq: 'custom', weekdays: [1, 3, 5], time: '07:00' })
  })
  it('monthly on a day', () => {
    const e = one('Pay rent repeat monthly on the 1st')
    expect(e.content).toBe('Pay rent')
    expect(e.repeatRule).toEqual({ freq: 'monthly', day_of_month: 1 })
  })
  it('weekends in the morning', () => {
    const e = one('Long run every weekend in the morning')
    expect(e.content).toBe('Long run')
    expect(e.repeatRule).toEqual({ freq: 'custom', weekdays: [0, 6], time: '09:00' })
  })
})

describe('dates', () => {
  it('tomorrow at six', () => {
    const e = one('Call mom tomorrow at 6 pm')
    expect(e.content).toBe('Call mom')
    expect(e.dueDate).toBe(day(1))
    expect(e.dueTime).toBe('18:00')
    expect(resolvedType(e, 'thought')).toBe('task')
  })
  it('date without time has no time', () => {
    const e = one('Submit the report tomorrow')
    expect(e.content).toBe('Submit the report')
    expect(e.dueDate).toBe(day(1))
    expect(e.dueTime).toBeNull()
  })
  it('thought keeps its date words', () => {
    const e = one('Thought maybe visit Goa tomorrow')
    expect(e.type).toBe('thought')
    expect(e.dueDate).toBeNull()
    expect(e.content).toBe('Maybe visit Goa tomorrow')
  })
})

describe('notes', () => {
  it('with a note', () => {
    const e = one('Book the dentist with a note ask about whitening')
    expect(e.content).toBe('Book the dentist')
    expect(e.note).toBe('ask about whitening')
  })
})

describe('everything together', () => {
  it('full command', () => {
    const e = one('Call mom tomorrow at 6 pm label as family make it repeating every week')
    expect(e.content).toBe('Call mom')
    expect(e.labels).toEqual(['family'])
    expect(e.repeatRule?.freq).toBe('weekly')
    expect(e.repeatRule?.time).toBe('18:00')
    expect(e.dueDate).toBeNull()
  })
})

describe('several entries', () => {
  it('next item splits', () => {
    const entries = parseCommands('Task buy milk next item thought learn the guitar next item goal read 20 books')
    expect(entries.map((e) => e.content)).toEqual(['Buy milk', 'Learn the guitar', 'Read 20 books'])
    expect(entries.map((e) => e.type)).toEqual(['task', 'thought', 'goal'])
  })
  it('empty is nothing', () => {
    expect(parseCommands('   ')).toEqual([])
    expect(parseCommands('next item')).toEqual([])
  })
})

describe('custom phrases', () => {
  it('switched-off default is ignored', () => {
    const phrases = effectivePhrases([{ action: 'repeating', phrase: 'every' }], [{ action: 'repeating', phrase: 'on repeat' }])
    const plain = one('Thank every volunteer', phrases)
    expect(plain.repeatRule).toBeNull()
    expect(plain.content).toBe('Thank every volunteer')
    const repeated = one('Stretch on repeat daily', phrases)
    expect(repeated.repeatRule?.freq).toBe('daily')
    expect(repeated.content).toBe('Stretch')
  })
  it('custom alias for label', () => {
    const phrases = [...effectivePhrases([], []), { action: 'label' as const, phrase: 'mark it as' }]
    const e = one('Fix the bike mark it as weekend', phrases)
    expect(e.content).toBe('Fix the bike')
    expect(e.labels).toEqual(['weekend'])
  })
})
