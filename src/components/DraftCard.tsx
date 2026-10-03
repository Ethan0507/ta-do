import { useState } from 'react'
import type { Category, EntryType } from '../types'
import { resolvedType, type ParsedEntry } from '../lib/commands/parser'
import { matchLabel } from '../lib/commands/executor'
import { RepeatPicker } from './RepeatPicker'
import { describeRule } from '../lib/recurrence'

// One entry being created — the same card as the iOS app's DraftCard: text plus a chip per
// option (type, date + time, repeat, labels, note). Click a chip to edit it, × to remove it,
// "+ …" to add one that isn't set. Date and repeat are for tasks only, and exclusive.

type Editor = 'date' | 'repeat' | 'labels' | 'note' | null
type IconName = 'calendar' | 'repeat' | 'tag' | 'note'

/** Line icons in the same style as the rest of the web app's SVGs. */
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, JSX.Element> = {
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2.5v3M16 2.5v3M3 10h18" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 2.1l4 4-4 4" />
        <path d="M3 12.1v-2a4 4 0 0 1 4-4h14" />
        <path d="M7 21.9l-4-4 4-4" />
        <path d="M21 11.9v2a4 4 0 0 1-4 4H3" />
      </>
    ),
    tag: (
      <>
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1.3" />
      </>
    ),
    note: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    ),
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

interface DraftCardProps {
  draft: ParsedEntry
  defaultType: EntryType
  categories: Category[]
  onChange: (draft: ParsedEntry) => void
  onRemove?: () => void
  readOnly?: boolean
}

const TYPES: EntryType[] = ['thought', 'task', 'goal']
const todayString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function describeDay(date: string): string {
  const today = todayString()
  const t = new Date(`${today}T00:00:00`)
  const d = new Date(`${date}T00:00:00`)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function DraftCard({ draft, defaultType, categories, onChange, onRemove, readOnly }: DraftCardProps) {
  const [editor, setEditor] = useState<Editor>(null)
  const [newLabel, setNewLabel] = useState('')
  const type = resolvedType(draft, defaultType)
  const set = (patch: Partial<ParsedEntry>) => onChange({ ...draft, ...patch })
  const toggle = (which: Editor) => setEditor((current) => (current === which ? null : which))

  const chip = 'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold'
  const optionChip = `${chip} bg-white/45 text-[var(--color-text)]`

  function OptionChip({ label, icon, which, onClear }: { label: string; icon: IconName; which: Editor; onClear: () => void }) {
    return (
      <span className={optionChip}>
        <button type="button" disabled={readOnly} onClick={() => toggle(which)} className="flex items-center gap-1.5">
          <Icon name={icon} />
          {label}
        </button>
        {!readOnly && (
          <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="text-[var(--color-text-faint)]">
            ×
          </button>
        )}
      </span>
    )
  }

  function AddChip({ label, which }: { label: string; which: Editor }) {
    return (
      <button
        type="button"
        onClick={() => toggle(which)}
        className={`${chip} border border-dashed border-[var(--color-primary)] text-[var(--color-primary)]`}
      >
        + {label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-fill-strong)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
      <div className="flex items-start gap-2">
        <textarea
          value={draft.content}
          onChange={(e) => set({ content: e.target.value })}
          readOnly={readOnly}
          rows={1}
          placeholder="What's on your mind?"
          className="flex-1 resize-none bg-transparent text-[15px] font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
        />
        {onRemove && !readOnly && (
          <button type="button" onClick={onRemove} aria-label="Remove this entry" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/45 text-xs">
            ×
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={type}
          disabled={readOnly}
          onChange={(e) => set({ type: e.target.value as EntryType })}
          className={`${chip} appearance-none bg-[var(--color-primary)] text-[var(--color-primary-on)]`}
          aria-label="Type"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {type === 'task' && draft.repeatRule && (
          <OptionChip label={describeRule(draft.repeatRule)} icon="repeat" which="repeat" onClear={() => set({ repeatRule: null })} />
        )}
        {type === 'task' && !draft.repeatRule && draft.dueDate && (
          <OptionChip
            label={`${describeDay(draft.dueDate)}${draft.dueTime ? ` · ${draft.dueTime}` : ''}`}
            icon="calendar"
            which="date"
            onClear={() => set({ dueDate: null, dueTime: null })}
          />
        )}
        {draft.labels.map((name) => {
          const existing = matchLabel(name, categories)
          return (
            <OptionChip
              key={name}
              label={existing ? existing.name : `${name.charAt(0).toUpperCase()}${name.slice(1)} (new)`}
              icon="tag"
              which="labels"
              onClear={() => set({ labels: draft.labels.filter((l) => l !== name) })}
            />
          )
        })}
        {draft.note && <OptionChip label={draft.note} icon="note" which="note" onClear={() => set({ note: null })} />}

        {!readOnly && (
          <>
            {type === 'task' && !draft.repeatRule && !draft.dueDate && (
              <>
                <AddChip label="Date" which="date" />
                <AddChip label="Repeat" which="repeat" />
              </>
            )}
            <AddChip label="Label" which="labels" />
            {!draft.note && <AddChip label="Note" which="note" />}
          </>
        )}
      </div>

      {editor === 'date' && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/40 p-3">
          <input
            type="date"
            value={draft.dueDate ?? todayString()}
            onChange={(e) => set({ dueDate: e.target.value || null })}
            className="rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-1.5 text-sm text-[var(--color-text)]"
          />
          <input
            type="time"
            value={draft.dueTime ?? ''}
            onChange={(e) => set({ dueDate: draft.dueDate ?? todayString(), dueTime: e.target.value || null })}
            className="rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-1.5 text-sm text-[var(--color-text)]"
          />
          {!draft.dueDate && (
            <button type="button" onClick={() => set({ dueDate: todayString() })} className="text-xs font-bold text-[var(--color-primary)]">
              Set
            </button>
          )}
        </div>
      )}

      {editor === 'repeat' && (
        <div className="rounded-2xl bg-white/40 p-3">
          <RepeatPicker value={draft.repeatRule ?? { freq: 'daily' }} dueDate={draft.dueDate ?? ''} onChange={(rule) => set({ repeatRule: rule })} />
        </div>
      )}

      {editor === 'labels' && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white/40 p-3">
          {categories.map((c) => {
            const on = draft.labels.some((l) => l.localeCompare(c.name, undefined, { sensitivity: 'base' }) === 0)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  set({
                    labels: on
                      ? draft.labels.filter((l) => l.localeCompare(c.name, undefined, { sensitivity: 'base' }) !== 0)
                      : [...draft.labels, c.name],
                  })
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  on ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]' : 'bg-white/45 text-[var(--color-text-muted)]'
                }`}
              >
                {c.name}
              </button>
            )
          })}
          <input
            type="text"
            placeholder="+ new"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newLabel.trim()) {
                e.preventDefault()
                set({ labels: [...draft.labels, newLabel.trim()] })
                setNewLabel('')
              }
            }}
            className="w-20 rounded-full border border-dashed border-[var(--glass-border)] bg-transparent px-2.5 py-1 text-xs text-[var(--color-text-muted)]"
          />
        </div>
      )}

      {editor === 'note' && (
        <textarea
          value={draft.note ?? ''}
          onChange={(e) => set({ note: e.target.value || null })}
          rows={3}
          autoFocus
          placeholder="Add a note…"
          className="w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-white/45 px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
        />
      )}
    </div>
  )
}
