import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import type { EntryType } from '../types'
import { parseCommands, type CommandPhrase, type ParsedEntry } from '../lib/commands/parser'

interface CaptureFabProps {
  type: EntryType
  /** The user's command phrases (same as the iOS app's voice phrases). */
  phrases: CommandPhrase[]
  onCapture: (content: string) => Promise<void>
  /** Opens the shared composer with these drafts. */
  onCompose: (drafts: ParsedEntry[]) => void
}

/** Each line is read separately (one entry per line), with the user's phrases. */
function draftsFrom(text: string, phrases: CommandPhrase[]): ParsedEntry[] {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .flatMap((line) => parseCommands(line, phrases))
}

const isPlain = (d: ParsedEntry) => !d.type && !d.labels.length && !d.dueDate && !d.repeatRule && !d.note

const TYPE_LABEL: Record<EntryType, string> = {
  thought: 'thought',
  task: 'task',
  goal: 'goal',
}

export function CaptureFab({ type, phrases, onCapture, onCompose }: CaptureFabProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resetTextareaHeight() {
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleTextareaInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    // Same rule as the iOS app: a plain single line saves instantly; several lines or any
    // command phrases (dates, labels, repeats…) open the composer to review.
    const drafts = draftsFrom(content, phrases)
    if (!(drafts.length === 1 && isPlain(drafts[0]))) {
      openComposer(drafts)
      return
    }

    setSubmitting(true)
    await onCapture(content.trim())
    setSubmitting(false)
    setContent('')
    resetTextareaHeight()
    setOpen(false)
  }

  function openComposer(drafts: ParsedEntry[]) {
    onCompose(drafts)
    setContent('')
    resetTextareaHeight()
    setOpen(false)
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-20 mx-auto flex max-w-md justify-end px-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[var(--color-primary)] shadow-[0_10px_26px_oklch(58%_0.16_290_/_0.45),0_0_0_6px_oklch(99%_0.01_285_/_0.5)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-on)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
            ref={formRef}
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

            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-[var(--color-primary)]">New {TYPE_LABEL[type]}</span>
              <button
                type="button"
                onClick={() => openComposer(content.trim() ? draftsFrom(content, phrases) : [])}
                className="flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1 text-xs font-bold text-[var(--color-primary)]"
                title="Date, repeat, labels and note"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                  <circle cx="16" cy="7" r="2" />
                  <circle cx="10" cy="17" r="2" />
                </svg>
                Options
              </button>
            </div>

            <div className="flex items-end gap-3">
              {type === 'task' ? (
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={content}
                  onChange={handleTextareaInput}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What's on your mind? One task per line to add several at once."
                  rows={1}
                  className="max-h-48 flex-1 resize-none overflow-y-auto rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-4 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                />
              ) : (
                <input
                  type="text"
                  autoFocus
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="flex-1 rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-4 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                />
              )}
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
