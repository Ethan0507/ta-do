import { useState } from 'react'
import type { Category, Entry, EntryType } from '../types'
import {
  setArchived,
  setGoalStatus,
  setTaskStatus,
  setEntryCategories,
  updateEntryContent,
  updateEntryDueDate,
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

export function EntryDetail({ entry, userId, categories, categoryIds, onClose, onChanged }: EntryDetailProps) {
  const [content, setContent] = useState(entry.content)
  const [type, setType] = useState<EntryType>(entry.type)

  // While `type` has just changed but `entry` hasn't caught up via a reload yet,
  // treat status as the fresh default rather than the stale value from the old type.
  const isDone = type === entry.type && ((type === 'task' && entry.task_status === 'done') || (type === 'goal' && entry.goal_status === 'achieved'))

  async function handleTypeChange(newType: EntryType) {
    await updateEntryType(entry.id, newType)
    setType(newType)
    onChanged()
  }

  async function commitContent() {
    if (content.trim() && content !== entry.content) {
      await updateEntryContent(entry.id, content.trim())
      onChanged()
    }
  }

  async function handleToggleStatus() {
    if (type === 'task') {
      await setTaskStatus(entry.id, isDone ? 'open' : 'done')
    } else if (type === 'goal') {
      await setGoalStatus(entry.id, isDone ? 'ongoing' : 'achieved')
    }
    onChanged()
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
          onBlur={commitContent}
          rows={3}
          className="w-full resize-none rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-3.5 text-[15px] text-[var(--color-text)] outline-none"
        />

        {type === 'task' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Due date</span>
            <input
              type="date"
              defaultValue={type === entry.type ? (entry.due_date ?? '') : ''}
              onChange={(e) => updateEntryDueDate(entry.id, e.target.value || null).then(onChanged)}
              className="w-fit rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-2 text-sm text-[var(--color-text)]"
            />
          </label>
        )}

        {type !== 'thought' && (
          <button
            type="button"
            onClick={handleToggleStatus}
            className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${
              isDone ? 'bg-[var(--color-success)] text-[var(--color-primary-on)]' : 'bg-white/45 text-[var(--color-text)]'
            }`}
          >
            {type === 'task' ? (isDone ? 'Done' : 'Mark done') : isDone ? 'Achieved' : 'Mark achieved'}
          </button>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Categories</span>
          <CategoryPicker
            allCategories={categories}
            selectedIds={categoryIds}
            onChange={(ids) => setEntryCategories(entry.id, ids).then(onChanged)}
            onCreateCategory={(name) => createCategory(userId, name).then(onChanged)}
          />
        </div>

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
