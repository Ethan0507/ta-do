import { useEffect, useMemo, useState } from 'react'
import type { Category } from '../types'
import { DEFAULT_PHRASES, parseCommands, type CommandAction } from '../lib/commands/parser'
import {
  ACTION_INFO,
  addCustomPhrase,
  cachedPhraseRows,
  fetchPhraseRows,
  phrasesFrom,
  removePhraseRow,
  setDefaultEnabled,
  type PhraseRow,
} from '../lib/commands/phrases'
import { fetchCategories } from '../lib/categories'
import { DraftCard } from './DraftCard'

// Voice phrases — same screen as the iOS app's Settings › Voice phrases. Typed capture on the
// web reads the same phrases, and changes here apply to the iOS app too.

const ACTIONS = Object.keys(ACTION_INFO) as CommandAction[]

export function VoicePhrasesSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [rows, setRows] = useState<PhraseRow[]>(cachedPhraseRows)
  const [categories, setCategories] = useState<Category[]>([])
  const [sample, setSample] = useState('')
  const [open, setOpen] = useState<CommandAction | null>(null)
  const [newPhrase, setNewPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reload = () => fetchPhraseRows().then(setRows).catch((err) => setError(err.message))

  useEffect(() => {
    reload()
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  const phrases = useMemo(() => phrasesFrom(rows), [rows])
  const preview = useMemo(() => parseCommands(sample, phrases), [sample, phrases])

  async function add(action: CommandAction) {
    try {
      const row = await addCustomPhrase(userId, rows, action, newPhrase)
      setRows((prev) => [...prev, row])
      setNewPhrase('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that phrase')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[90dvh] max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
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

        <span className="text-[17px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          Voice phrases
        </span>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Try a phrase</span>
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            rows={2}
            placeholder="e.g. Call mom tomorrow at 6 label as family"
            className="w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-white/45 px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          {preview.map((draft) => (
            <DraftCard key={draft.id} draft={draft} defaultType="thought" categories={categories} onChange={() => {}} readOnly />
          ))}
          <span className="text-[11px] text-[var(--color-text-faint)]">
            This is exactly how typed capture here — and voice capture and Siri on iPhone — will read it.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {ACTIONS.map((action) => {
            const info = ACTION_INFO[action]
            const active = phrases.filter((p) => p.action === action)
            const custom = rows.filter((r) => r.kind === 'custom' && r.action === action)
            const defaults = DEFAULT_PHRASES.filter((p) => p.action === action)
            const isOpen = open === action
            return (
              <div key={action} className="rounded-2xl border border-[var(--glass-border)] bg-white/40">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(isOpen ? null : action)
                    setNewPhrase('')
                    setError(null)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--color-text)]">{info.title}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">
                      {active.map((p) => `“${p.phrase}”`).join(', ') || 'No phrases'}
                    </span>
                  </span>
                  <span className={`text-[var(--color-text-faint)] transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-[var(--glass-border)] px-3.5 py-3">
                    <p className="text-[13px] text-[var(--color-text)]">
                      {info.explanation}
                      <span className="block text-xs text-[var(--color-text-muted)]">Example: “{info.example}”</span>
                    </p>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)]">Your phrases</span>
                      {custom.map((row) => (
                        <div key={row.id} className="flex items-center justify-between rounded-xl bg-white/45 px-3 py-1.5 text-sm">
                          <span>{row.phrase}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await removePhraseRow(row.id)
                              setRows((prev) => prev.filter((r) => r.id !== row.id))
                            }}
                            className="text-xs font-bold text-[var(--color-text-faint)]"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPhrase}
                          onChange={(e) => setNewPhrase(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              add(action)
                            }
                          }}
                          placeholder="Add your own phrase"
                          className="flex-1 rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-1.5 text-sm text-[var(--color-text)] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => add(action)}
                          disabled={!newPhrase.trim()}
                          className="rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-[var(--color-primary-on)] disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      {error && <span className="text-xs font-semibold text-[var(--color-tertiary)]">{error}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)]">Built-in phrases</span>
                      {defaults.map((phrase) => {
                        const enabled = !rows.some(
                          (r) => r.kind === 'disabled_default' && r.action === action && r.phrase.toLowerCase() === phrase.phrase.toLowerCase(),
                        )
                        return (
                          <label key={phrase.phrase} className="flex items-center justify-between text-sm text-[var(--color-text)]">
                            <span>{phrase.phrase}</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              onClick={async () => {
                                await setDefaultEnabled(userId, rows, phrase, !enabled)
                                await reload()
                              }}
                              className={`h-[18px] w-8 rounded-full p-0.5 transition-colors ${enabled ? 'bg-[var(--color-primary)]' : 'bg-black/20'}`}
                            >
                              <div className={`h-[14px] w-[14px] rounded-full bg-white transition-transform ${enabled ? 'translate-x-[14px]' : ''}`} />
                            </button>
                          </label>
                        )
                      })}
                      <span className="text-[11px] text-[var(--color-text-faint)]">Switch off any that get picked up by mistake in normal writing.</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
