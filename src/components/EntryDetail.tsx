import { useEffect, useState } from 'react'
import type { Category, Entry, EntryType, RecurrenceRule } from '../types'
import {
  setArchived,
  setGoalStatus,
  setTaskStatus,
  setEntryCategories,
  updateEntryContent,
  updateEntryDueDate,
  updateEntryNotes,
  updateEntryType,
} from '../lib/entries'
import { fetchHabit, fetchRecurrenceTemplate, setEntryRecurrence } from '../lib/habits'
import { createCategory } from '../lib/categories'
import { CategoryPicker } from './CategoryPicker'
import { TypeSelector } from './TypeSelector'
import { RepeatPicker } from './RepeatPicker'

interface EntryDetailProps {
  entry: Entry
  userId: string
  categories: Category[]
  categoryIds: string[]
  onClose: () => void
  onChanged: () => void
  /** Opens a generated task's template where templates live (Library). */
  onOpenTemplate?: (template: Entry) => void
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((id) => setB.has(id))
}

export function EntryDetail({ entry, userId, categories, categoryIds, onClose, onChanged, onOpenTemplate }: EntryDetailProps) {
  const isTemplate = entry.is_recurrence_template
  const isOccurrence = entry.is_generated
  const [content, setContent] = useState(entry.content)
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [type, setType] = useState<EntryType>(entry.type)
  const [dueDate, setDueDate] = useState(entry.due_date ?? '')
  const [rule, setRule] = useState<RecurrenceRule | null>(null)
  const [initialRule, setInitialRule] = useState<RecurrenceRule | null>(null)
  const [template, setTemplate] = useState<Entry | null>(null)
  const [saving, setSaving] = useState(false)
  const [localCategoryIds, setLocalCategoryIds] = useState<string[]>(categoryIds)
  const [detailsOpen, setDetailsOpen] = useState(Boolean(entry.notes) || categoryIds.length > 0)
  const [isDone, setIsDone] = useState(
    entry.type === 'task' ? entry.task_status === 'done' : entry.type === 'goal' ? entry.goal_status === 'achieved' : false,
  )

  function handleTypeChange(newType: EntryType) {
    setType(newType)
    setIsDone(false)
  }

  useEffect(() => {
    let cancelled = false
    async function loadRecurrence() {
      if (!entry.habit_id) return
      if (isTemplate) {
        const habit = await fetchHabit(entry.habit_id)
        if (cancelled || !habit) return
        setRule(habit.recurrence_rule)
        setInitialRule(habit.recurrence_rule)
      } else if (isOccurrence) {
        const found = await fetchRecurrenceTemplate(entry.habit_id)
        if (!cancelled) setTemplate(found)
      }
    }
    loadRecurrence()
    return () => {
      cancelled = true
    }
  }, [entry.habit_id, isTemplate, isOccurrence])

  const originalIsDone = entry.type === 'task' ? entry.task_status === 'done' : entry.type === 'goal' ? entry.goal_status === 'achieved' : false

  const ruleChanged = JSON.stringify(rule) !== JSON.stringify(initialRule)
  const templateContentChanged = isTemplate && Boolean(content.trim()) && content.trim() !== entry.content

  const isDirty =
    type !== entry.type ||
    content.trim() !== entry.content ||
    notes.trim() !== (entry.notes ?? '') ||
    (type === 'task' && !isTemplate && dueDate !== (entry.due_date ?? '')) ||
    (type === 'task' && !isOccurrence && ruleChanged) ||
    (type === entry.type && type !== 'thought' && isDone !== originalIsDone) ||
    !sameIds(localCategoryIds, categoryIds)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      await saveChanges()
    } finally {
      setSaving(false)
    }
    onChanged()
    onClose()
  }

  async function saveChanges() {
    if (type !== entry.type) {
      await updateEntryType(entry.id, type)
    }
    if (type === 'task') {
      // Only on an actual toggle, so saving notes on a missed task doesn't reopen it.
      if (!isTemplate && type === entry.type && isDone !== originalIsDone) {
        await setTaskStatus(entry.id, isDone ? 'done' : 'open')
      }
      if (!isTemplate) {
        await updateEntryDueDate(entry.id, dueDate || null)
      }
    } else if (type === 'goal') {
      await setGoalStatus(entry.id, isDone ? 'achieved' : 'ongoing')
    }
    if (content.trim() && content.trim() !== entry.content) {
      await updateEntryContent(entry.id, content.trim())
    }
    if (notes.trim() !== (entry.notes ?? '')) {
      await updateEntryNotes(entry.id, notes.trim())
    }
    if (!sameIds(localCategoryIds, categoryIds)) {
      await setEntryCategories(entry.id, localCategoryIds)
    }
    // Last, so the template is fully saved before today's task is copied from it.
    if (type === 'task' && !isOccurrence && (ruleChanged || templateContentChanged)) {
      await setEntryRecurrence(entry.id, userId, content.trim() || entry.content, rule, entry.habit_id)
    }
  }

  async function handleArchiveToggle() {
    if (!entry.archived_at && !confirm('Archive this entry?')) return
    await setArchived(entry.id, !entry.archived_at)
    onChanged()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[85dvh] max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
        <div className="relative flex items-center justify-center">
          <div className="h-1 w-9 rounded-full bg-black/20" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {isTemplate ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)]">
            <RepeatIcon />
            Repeating task — changes apply to tasks created from now on
          </div>
        ) : (
          <TypeSelector value={type} onChange={handleTypeChange} />
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-3.5 text-[15px] text-[var(--color-text)] outline-none"
        />

        {type === 'task' && !isTemplate && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-fit rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-2 text-sm text-[var(--color-text)]"
            />
          </label>
        )}

        {type === 'task' && isOccurrence && template && onOpenTemplate && (
          <button
            type="button"
            onClick={() => onOpenTemplate(template)}
            className="flex w-fit items-center gap-1.5 rounded-full bg-white/45 px-3.5 py-1.5 text-xs font-bold text-[var(--color-primary)]"
          >
            <RepeatIcon />
            Edit repeating task
          </button>
        )}

        {type === 'task' && !isOccurrence && <RepeatPicker value={rule} dueDate={dueDate} onChange={setRule} />}

        {type !== 'thought' && !isTemplate && (
          <button
            type="button"
            onClick={() => setIsDone((d) => !d)}
            className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${
              isDone ? 'bg-[var(--color-success)] text-[var(--color-primary-on)]' : 'bg-white/45 text-[var(--color-text)]'
            }`}
          >
            {type === 'task' ? (isDone ? 'Done' : 'Mark done') : isDone ? 'Achieved' : 'Mark achieved'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex items-center justify-between px-0.5 py-1 text-xs font-bold text-[var(--color-text-muted)]"
        >
          <span>Add notes &amp; categories</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {detailsOpen && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes…"
                className="w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-white/45 px-[18px] py-3.5 text-[14px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">Categories</span>
              <CategoryPicker
                allCategories={categories}
                selectedIds={localCategoryIds}
                onChange={setLocalCategoryIds}
                onCreateCategory={(name) => createCategory(userId, name).then(onChanged)}
              />
            </div>
          </>
        )}

        {isDirty && (
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-[var(--glass-border)] bg-white/40 py-2.5 text-sm font-bold text-[var(--color-text-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-full disabled:opacity-60 bg-[var(--color-primary)] py-2.5 text-sm font-bold text-[var(--color-primary-on)]"
            >
              Save changes
            </button>
          </div>
        )}

        <div className="mt-1 flex justify-end border-t border-[var(--glass-border)] pt-3">
          <button type="button" onClick={handleArchiveToggle} className="text-xs font-bold text-[var(--color-text-faint)]">
            {entry.archived_at ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </div>
    </>
  )
}

function RepeatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2.1l4 4-4 4" />
      <path d="M3 12.1v-2a4 4 0 0 1 4-4h14" />
      <path d="M7 21.9l-4-4 4-4" />
      <path d="M21 11.9v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}
