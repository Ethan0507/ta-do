import { useEffect, useState } from 'react'
import type { Category, EntryType } from '../types'
import { emptyDraft, resolvedType, type ParsedEntry } from '../lib/commands/parser'
import { fetchCategories } from '../lib/categories'
import { DraftCard } from './DraftCard'

// The shared composer — same as the iOS app's: a card per entry, "Add another", Save.
// Opened from the capture panel's Options button, for several lines, or when the typed text
// contains command phrases (dates, labels, repeats…).

interface ComposerSheetProps {
  initialDrafts: ParsedEntry[]
  defaultType: EntryType
  onClose: () => void
  onSave: (drafts: ParsedEntry[]) => Promise<void>
}

export function ComposerSheet({ initialDrafts, defaultType, onClose, onSave }: ComposerSheetProps) {
  const [drafts, setDrafts] = useState<ParsedEntry[]>(initialDrafts.length ? initialDrafts : [emptyDraft()])
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  const ready = drafts.filter((d) => d.content.trim())
  const title =
    drafts.length > 1 ? 'New entries' : `New ${resolvedType(drafts[0] ?? emptyDraft(), defaultType)}`
  const saveLabel = saving
    ? 'Saving…'
    : ready.length === 1
      ? `Save ${resolvedType(ready[0], defaultType)}`
      : `Save ${ready.length}`

  async function handleSave() {
    if (!ready.length) return
    setSaving(true)
    try {
      await onSave(ready)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[90dvh] max-w-md flex-col gap-3 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
        <div className="relative flex items-center justify-center">
          <div className="h-1 w-9 rounded-full bg-black/20" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-0 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <span className="text-[12.5px] font-bold text-[var(--color-primary)]">{title.charAt(0).toUpperCase() + title.slice(1)}</span>

        {drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            defaultType={defaultType}
            categories={categories}
            onChange={(next) => setDrafts((prev) => prev.map((d) => (d.id === draft.id ? next : d)))}
            onRemove={drafts.length > 1 ? () => setDrafts((prev) => prev.filter((d) => d.id !== draft.id)) : undefined}
          />
        ))}

        <button
          type="button"
          onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}
          className="w-fit px-1 py-1 text-sm font-bold text-[var(--color-primary)]"
        >
          + Add another
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || ready.length === 0}
          className="rounded-full bg-[var(--color-primary)] py-3 text-sm font-bold text-[var(--color-primary-on)] disabled:opacity-50"
        >
          {saveLabel}
        </button>
      </div>
    </>
  )
}
