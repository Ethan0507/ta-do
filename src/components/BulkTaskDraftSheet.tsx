import { useState } from 'react'

interface Draft {
  key: number
  content: string
}

interface BulkTaskDraftSheetProps {
  initialLines: string[]
  onClose: () => void
  onConfirm: (contents: string[]) => Promise<void>
}

export function BulkTaskDraftSheet({ initialLines, onClose, onConfirm }: BulkTaskDraftSheetProps) {
  const [drafts, setDrafts] = useState<Draft[]>(initialLines.map((content, i) => ({ key: i, content })))
  const [nextKey, setNextKey] = useState(initialLines.length)
  const [submitting, setSubmitting] = useState(false)

  const readyCount = drafts.filter((d) => d.content.trim()).length

  function updateDraft(key: number, content: string) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, content } : d)))
  }

  function removeDraft(key: number) {
    setDrafts((prev) => prev.filter((d) => d.key !== key))
  }

  function addDraft() {
    setDrafts((prev) => [...prev, { key: nextKey, content: '' }])
    setNextKey((k) => k + 1)
  }

  async function handleConfirm() {
    const contents = drafts.map((d) => d.content.trim()).filter(Boolean)
    if (contents.length === 0) return
    setSubmitting(true)
    try {
      await onConfirm(contents)
    } finally {
      setSubmitting(false)
    }
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

        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Review {readyCount} task{readyCount === 1 ? '' : 's'}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Edit or remove any line, then create them all at once.</p>
        </div>

        <div className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <div key={draft.key} className="flex items-center gap-2">
              <input
                type="text"
                value={draft.content}
                onChange={(e) => updateDraft(draft.key, e.target.value)}
                placeholder="Task…"
                className="flex-1 rounded-xl border border-[var(--glass-border)] bg-white/45 px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={() => removeDraft(draft.key)}
                aria-label="Remove task"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/45 text-[var(--color-text-faint)]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addDraft}
            className="w-fit px-1 py-1 text-xs font-bold text-[var(--color-primary)]"
          >
            + Add another
          </button>
        </div>

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
            onClick={handleConfirm}
            disabled={submitting || readyCount === 0}
            className="flex-1 rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-[var(--color-primary-on)] disabled:opacity-50"
          >
            {submitting ? 'Creating…' : `Create ${readyCount} task${readyCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </>
  )
}
