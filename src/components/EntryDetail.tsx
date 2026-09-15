import { useState } from 'react'
import type { Category, Entry, EntryType } from '../types'
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
import { createCategory } from '../lib/categories'
import { CategoryPicker } from './CategoryPicker'
import { TypeSelector } from './TypeSelector'

interface EntryDetailProps {
  entry: Entry
  userId: string
  categories: Category[]
  categoryIds: string[]
  onClose: () => void
  onChanged: () => void
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((id) => setB.has(id))
}

export function EntryDetail({ entry, userId, categories, categoryIds, onClose, onChanged }: EntryDetailProps) {
  const [content, setContent] = useState(entry.content)
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [type, setType] = useState<EntryType>(entry.type)
  const [dueDate, setDueDate] = useState(entry.due_date ?? '')
  const [localCategoryIds, setLocalCategoryIds] = useState<string[]>(categoryIds)
  const [isDone, setIsDone] = useState(
    entry.type === 'task' ? entry.task_status === 'done' : entry.type === 'goal' ? entry.goal_status === 'achieved' : false,
  )

  function handleTypeChange(newType: EntryType) {
    setType(newType)
    setIsDone(false)
  }

  const originalIsDone = entry.type === 'task' ? entry.task_status === 'done' : entry.type === 'goal' ? entry.goal_status === 'achieved' : false

  const isDirty =
    type !== entry.type ||
    content.trim() !== entry.content ||
    notes.trim() !== (entry.notes ?? '') ||
    (type === 'task' && dueDate !== (entry.due_date ?? '')) ||
    (type === entry.type && type !== 'thought' && isDone !== originalIsDone) ||
    !sameIds(localCategoryIds, categoryIds)

  async function handleSave() {
    if (type !== entry.type) {
      await updateEntryType(entry.id, type)
    }
    if (type === 'task') {
      await setTaskStatus(entry.id, isDone ? 'done' : 'open')
      await updateEntryDueDate(entry.id, dueDate || null)
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
    onChanged()
    onClose()
  }

  async function handleArchiveToggle() {
    await setArchived(entry.id, !entry.archived_at)
    onChanged()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[85vh] max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
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

        <TypeSelector value={type} onChange={handleTypeChange} />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-3.5 text-[15px] text-[var(--color-text)] outline-none"
        />

        {type === 'task' && (
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

        {type !== 'thought' && (
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
              className="flex-1 rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-[var(--color-primary-on)]"
            >
              Save changes
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleArchiveToggle}
          className="w-fit rounded-full border border-[var(--glass-border)] bg-white/40 px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)]"
        >
          {entry.archived_at ? 'Unarchive' : 'Archive'}
        </button>
      </div>
    </>
  )
}
