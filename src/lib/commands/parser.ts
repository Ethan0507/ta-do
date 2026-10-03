// Voice/typed command parser — a port of the iOS CommandParser (ios/TaDo/Voice/CommandParser.swift)
// so both apps read a sentence the same way. Text before the first trigger phrase is the entry;
// each phrase takes the words up to the next phrase; the longest phrase wins where they overlap.
// Shared test sentences: parser.test.ts mirrors ios/TaDoTests/CommandParserTests.swift.
import * as chrono from 'chrono-node'
import type { EntryType, RecurrenceRule } from '../../types'

export type CommandAction = 'task' | 'thought' | 'goal' | 'label' | 'repeating' | 'due' | 'note' | 'next'

export interface CommandPhrase {
  action: CommandAction
  phrase: string
}

export interface ParsedEntry {
  id: string
  content: string
  /** Explicitly said ("task …", "as a goal"); null = decide from context. */
  type: EntryType | null
  labels: string[]
  /** YYYY-MM-DD */
  dueDate: string | null
  /** HH:MM */
  dueTime: string | null
  repeatRule: RecurrenceRule | null
  note: string | null
}

let nextId = 0
export function emptyDraft(content = ''): ParsedEntry {
  return { id: `draft-${++nextId}`, content, type: null, labels: [], dueDate: null, dueTime: null, repeatRule: null, note: null }
}

/** A due date or repeat only makes sense on a task, so they imply one. */
export function resolvedType(entry: ParsedEntry, fallback: EntryType): EntryType {
  if (entry.type) return entry.type
  return entry.dueDate || entry.repeatRule ? 'task' : fallback
}

const p = (action: CommandAction, list: string[]): CommandPhrase[] => list.map((phrase) => ({ action, phrase }))

export const DEFAULT_PHRASES: CommandPhrase[] = [
  ...p('task', ['new task', 'add a task', 'add task', 'task', 'as a task', 'make it a task']),
  ...p('thought', ['new thought', 'thought', 'note to self', 'as a thought', 'make it a thought']),
  ...p('goal', ['new goal', 'add a goal', 'goal', 'as a goal', 'make it a goal']),
  ...p('label', ['label as', 'label it as', 'label it', 'labelled as', 'labeled as', 'tag as', 'tag it as', 'tag it', 'category']),
  ...p('repeating', ['make it repeating', 'make it recurring', 'make it a recurring task', 'make it a repeating task', 'repeating', 'recurring', 'repeat', 'repeats', 'every']),
  ...p('due', ['due on', 'due by', 'due']),
  ...p('note', ['with a note', 'with note', 'add a note']),
  ...p('next', ['next item', 'new item', 'and then']),
]

/** Bare type words only count at the start ("task call mom"), not mid-sentence. */
const START_ONLY = new Set(['task', 'thought', 'goal'])

const phraseKey = (p: CommandPhrase) => `${p.action}|${p.phrase.toLowerCase()}`

/** Defaults minus any the user switched off, plus their own. */
export function effectivePhrases(disabled: CommandPhrase[], custom: CommandPhrase[]): CommandPhrase[] {
  const off = new Set(disabled.map(phraseKey))
  return [...DEFAULT_PHRASES.filter((p) => !off.has(phraseKey(p))), ...custom]
}

interface Match {
  action: CommandAction
  start: number
  end: number
  phrase: string
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function findMatches(text: string, phrases: CommandPhrase[]): Match[] {
  const taken: [number, number][] = []
  const matches: Match[] = []
  const ordered = phrases.filter((p) => p.phrase.trim()).sort((a, b) => b.phrase.length - a.phrase.length)
  for (const phrase of ordered) {
    const re = new RegExp(`\\b${escapeRegex(phrase.phrase.trim())}\\b`, 'gi')
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0
      const end = start + m[0].length
      if (taken.some(([s, e]) => start < e && end > s)) continue
      taken.push([start, end])
      matches.push({ action: phrase.action, start, end, phrase: phrase.phrase })
    }
  }
  return matches.sort((a, b) => a.start - b.start)
}

export function parseCommands(transcript: string, phrases: CommandPhrase[] = DEFAULT_PHRASES, now: Date = new Date()): ParsedEntry[] {
  const text = transcript.trim()
  if (!text) return []
  const segments: string[] = []
  let cursor = 0
  for (const m of findMatches(text, phrases)) {
    if (m.action !== 'next') continue
    segments.push(text.slice(cursor, m.start))
    cursor = m.end
  }
  segments.push(text.slice(cursor))
  return segments.map((s) => parseSegment(s, phrases, now)).filter((e): e is ParsedEntry => e !== null)
}

function parseSegment(segment: string, phrases: CommandPhrase[], now: Date): ParsedEntry | null {
  const text = segment.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
  if (!text) return null
  const matches = findMatches(text, phrases).filter((m) => {
    if (m.action === 'next') return false
    if (!START_ONLY.has(m.phrase.toLowerCase())) return true
    return text.slice(0, m.start).trim() === ''
  })

  const entry = emptyDraft()
  const contentParts: string[] = [matches.length ? text.slice(0, matches[0].start) : text]

  matches.forEach((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].start : text.length
    const argument = text.slice(m.end, end)
    switch (m.action) {
      case 'task':
      case 'thought':
      case 'goal':
        entry.type = m.action
        contentParts.push(argument) // the entry continues after a type word
        break
      case 'label':
        entry.labels.push(...splitList(argument))
        break
      case 'repeating': {
        const ruleText = m.phrase.toLowerCase() === 'every' ? `every ${argument}` : argument
        const [rule, leftover] = parseRepeat(ruleText, now)
        entry.repeatRule = rule
        if (leftover) contentParts.push(leftover)
        break
      }
      case 'due': {
        const found = detectDate(argument, now)
        if (found) {
          entry.dueDate = found.date
          entry.dueTime = found.time
          contentParts.push(found.remainder)
        } else {
          contentParts.push(argument)
        }
        break
      }
      case 'note':
        entry.note = clean(argument)
        break
    }
  })

  let content = clean(contentParts.join(' '))

  // A date said anywhere ("call mom tomorrow at 6") — unless it's explicitly a thought or goal.
  if (!entry.dueDate && (entry.type === null || entry.type === 'task')) {
    const found = detectDate(content, now)
    if (found) {
      content = clean(found.remainder)
      if (entry.repeatRule) {
        // A repeating task's template has no due date; a time said with it is when each day's task is due.
        if (!entry.repeatRule.time && found.time) entry.repeatRule = { ...entry.repeatRule, time: found.time } as RecurrenceRule
      } else {
        entry.dueDate = found.date
        entry.dueTime = found.time
      }
    }
  }

  // Text after a command word starts lowercase ("task call mom") — capitalise it.
  entry.content = content.charAt(0).toUpperCase() + content.slice(1)
  return entry.content ? entry : null
}

// MARK: Repeat rules

const WEEKDAYS: { names: string[]; day: number }[] = [
  { names: ['sunday', 'sundays', 'sun'], day: 0 },
  { names: ['monday', 'mondays', 'mon'], day: 1 },
  { names: ['tuesday', 'tuesdays', 'tue', 'tues'], day: 2 },
  { names: ['wednesday', 'wednesdays', 'wed'], day: 3 },
  { names: ['thursday', 'thursdays', 'thu', 'thurs'], day: 4 },
  { names: ['friday', 'fridays', 'fri'], day: 5 },
  { names: ['saturday', 'saturdays', 'sat'], day: 6 },
]

/** "every weekday at 7 am" → custom Mon–Fri 07:00. Returns words it didn't use. */
export function parseRepeat(raw: string, now: Date = new Date()): [RecurrenceRule, string] {
  let text = ` ${raw.toLowerCase()} `
  const timeResult = extractTime(text)
  let time: string | undefined
  if (timeResult) {
    time = timeResult.time
    text = timeResult.text
  }

  const consume = (words: string[]): boolean => {
    let hit = false
    for (const word of words) {
      const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'g')
      if (re.test(text)) {
        text = text.replace(re, ' ')
        hit = true
      }
    }
    return hit
  }

  let rule: RecurrenceRule
  if (consume(['weekdays', 'weekday', 'work days', 'workdays'])) {
    rule = { freq: 'custom', weekdays: [1, 2, 3, 4, 5] }
  } else if (consume(['weekends', 'weekend'])) {
    rule = { freq: 'custom', weekdays: [0, 6] }
  } else {
    const days = WEEKDAYS.filter((w) => consume(w.names)).map((w) => w.day).sort((a, b) => a - b)
    if (days.length === 1) {
      rule = { freq: 'weekly', weekday: days[0] }
    } else if (days.length > 1) {
      rule = { freq: 'custom', weekdays: days }
    } else if (consume(['monthly', 'every month', 'month', 'months'])) {
      let day = now.getDate()
      const m = text.match(/\b(\d{1,2})(st|nd|rd|th)?\b/)
      if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
        day = Number(m[1])
        text = text.replace(m[0], ' ')
      }
      rule = { freq: 'monthly', day_of_month: day }
    } else if (consume(['weekly', 'every week', 'week', 'weeks'])) {
      rule = { freq: 'weekly', weekday: now.getDay() }
    } else {
      consume(['daily', 'every day', 'each day', 'day', 'days'])
      rule = { freq: 'daily' }
    }
  }
  if (time) rule = { ...rule, time } as RecurrenceRule

  consume(['every', 'each', 'on', 'the', 'and', 'at', 'of', 'a', 'it', 'is'])
  return [rule, clean(text)]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Pulls a time ("at 7", "7 am", "18:30", "in the morning") out of the text. */
export function extractTime(text: string): { time: string; text: string } | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i, (m) => toTime(m[1], m[2], m[3])],
    [/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/i, (m) => toTime(m[1], m[2])],
    [/\bat\s+(\d{1,2})\b(?!\s*(?:st|nd|rd|th))/i, (m) => toTime(m[1])],
    [/\b(?:in the )?morning\b/i, () => '09:00'],
    [/\b(?:in the )?afternoon\b/i, () => '14:00'],
    [/\b(?:in the )?evening\b/i, () => '18:00'],
    [/\b(?:at )?night\b/i, () => '21:00'],
    [/\bnoon\b/i, () => '12:00'],
  ]
  for (const [re, read] of patterns) {
    const m = text.match(re)
    if (!m) continue
    const time = read(m)
    if (!time) continue
    return { time, text: text.replace(m[0], ' ') }
  }
  return null
}

function toTime(hourText: string, minuteText?: string, meridiem?: string): string | null {
  let hour = Number(hourText)
  const minute = minuteText ? Number(minuteText) : 0
  const mer = meridiem?.toLowerCase()
  if (mer?.startsWith('p') && hour < 12) hour += 12
  if (mer?.startsWith('a') && hour === 12) hour = 0
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${pad(hour)}:${pad(minute)}`
}

// MARK: Dates

/** Finds a date/time phrase ("tomorrow at 6 pm", "next friday", "on the 12th"). */
export function detectDate(text: string, now: Date = new Date()): { date: string; time: string | null; remainder: string } | null {
  const results = chrono.parse(text, now, { forwardDate: true })
  const result = results[0]
  if (!result) return null
  const d = result.start.date()
  // chrono fills a default time for date-only phrases — only keep a time that was said.
  const said = extractTime(result.text)
  const time = said?.time ?? (result.start.isCertain('hour') ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null)
  const prefix = text.slice(0, result.index).replace(/\b(on|by|at|for|due)\s*$/i, '')
  const suffix = text.slice(result.index + result.text.length)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time,
    remainder: clean(`${prefix} ${suffix}`),
  }
}

// MARK: Text helpers

/** "family and work, health" → ["family", "work", "health"] */
export function splitList(text: string): string[] {
  return text
    .replace(/&/g, ',')
    .replace(/ and /gi, ',')
    .split(',')
    .map((s) => clean(clean(s).replace(/^(as|it|to|with)\s+/i, '')))
    .filter(Boolean)
}

/** Trims whitespace, stray punctuation and connector words left at either end. */
export function clean(text: string): string {
  let s = text.replace(/\s+/g, ' ')
  const connectors = ['and', 'then', 'also', 'please', 'with', 'to', 'it', 'as', 'a']
  let changed = true
  while (changed) {
    changed = false
    s = s.replace(/^[\s,.;:\-–—!?]+|[\s,.;:\-–—!?]+$/g, '')
    for (const word of connectors) {
      if (s.toLowerCase().endsWith(` ${word}`)) {
        s = s.slice(0, -(word.length + 1))
        changed = true
      }
      if (s.toLowerCase() === word) {
        s = ''
        changed = true
      }
    }
  }
  return s
}
