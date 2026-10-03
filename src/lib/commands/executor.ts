// Saves composed entries the same way the iOS CommandExecutor does: create the entry, then
// date/time, note, labels, and the repeat last (so today's generated task copies everything —
// docs/schema.md "Recurring tasks — specification").
import type { Category, EntryType } from '../../types'
import { createCategory, fetchCategories } from '../categories'
import { createEntry, fetchTodayEntries, getTopPosition, setEntryCategories, updateEntryDueDate, updateEntryDueTime, updateEntryNotes } from '../entries'
import { setEntryRecurrence } from '../habits'
import { resolvedType, type ParsedEntry } from './parser'

export function matchLabel(name: string, categories: Category[]): Category | undefined {
  return categories.find((c) => c.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0)
}

const capitalize = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export async function saveDrafts(drafts: ParsedEntry[], defaultType: EntryType, userId: string): Promise<void> {
  let categories = await fetchCategories()
  const tops = new Map<EntryType, number>()

  for (const draft of drafts) {
    const content = draft.content.trim()
    if (!content) continue
    const type = resolvedType(draft, defaultType)
    if (!tops.has(type)) tops.set(type, getTopPosition(await fetchTodayEntries(type)))
    const position = tops.get(type)!
    tops.set(type, position - 1024)

    const entry = await createEntry(userId, type, content, null, position)

    if (type === 'task' && !draft.repeatRule && draft.dueDate) {
      await updateEntryDueDate(entry.id, draft.dueDate)
      if (draft.dueTime) await updateEntryDueTime(entry.id, draft.dueTime)
    }
    if (draft.note?.trim()) await updateEntryNotes(entry.id, draft.note.trim())
    if (draft.labels.length) {
      const ids: string[] = []
      for (const name of draft.labels) {
        const existing = matchLabel(name, categories)
        if (existing) {
          ids.push(existing.id)
        } else {
          const created = await createCategory(userId, capitalize(name))
          categories = [...categories, created]
          ids.push(created.id)
        }
      }
      await setEntryCategories(entry.id, [...new Set(ids)])
    }
    if (type === 'task' && draft.repeatRule) {
      await setEntryRecurrence(entry.id, userId, content, draft.repeatRule, null)
    }
  }
}
