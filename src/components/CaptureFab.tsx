import { useState, type FormEvent } from 'react'
import type { EntryType } from '../types'

interface CaptureFabProps {
  type: EntryType
  onCapture: (content: string) => Promise<void>
}

const TYPE_LABEL: Record<EntryType, string> = {
  thought: 'thought',
  task: 'task',
  goal: 'goal',
}

export function CaptureFab({ type, onCapture }: CaptureFabProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    await onCapture(content.trim())
    setSubmitting(false)
    setContent('')
    setOpen(false)
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-20 mx-auto flex max-w-md justify-end px-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-[60px] w-[60px] items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill-strong)] shadow-[var(--glass-shadow)] backdrop-blur-2xl"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <form
            onSubmit={handleSubmit}
            className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md flex-col gap-4 rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl"
          >
            <div className="relative flex items-center justify-center">
              <div className="h-1 w-9 rounded-full bg-black/20" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-0 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <span className="text-[12.5px] font-bold text-[var(--color-primary)]">New {TYPE_LABEL[type]}</span>

            <div className="flex items-center gap-3">
              <input
                type="text"
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-1 rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-4 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] shadow-lg disabled:opacity-50"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-on)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </form>
        </>
      )}
    </>
  )
}
