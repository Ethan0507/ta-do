import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Category, Entry, EntryType } from '../types'
import { fetchEntries, fetchEntryCategoryIds } from '../lib/entries'
import { fetchCategories } from '../lib/categories'
import { GlassBackdrop } from '../components/GlassBackdrop'
import { EntryDetail } from '../components/EntryDetail'
import { CaptureSetup } from '../components/CaptureSetup'

interface LibraryProps {
  session: Session
  onBack: () => void
}

type SortMode = 'category' | 'newest'

const TYPE_FILTERS: { value: EntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'thought', label: 'Thoughts' },
  { value: 'task', label: 'Tasks' },
  { value: 'goal', label: 'Goals' },
]

export function Library({ session, onBack }: LibraryProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [entryCategoryIds, setEntryCategoryIds] = useState<Record<string, string[]>>({})
  const [showArchived, setShowArchived] = useState(false)
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const [sortMode, setSortMode] = useState<SortMode>('category')
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [captureSetupOpen, setCaptureSetupOpen] = useState(false)

  const reload = useCallback(async () => {
    const [entryRows, categoryRows, categoryMap] = await Promise.all([
      fetchEntries(showArchived),
      fetchCategories(),
      fetchEntryCategoryIds(),
    ])
    setEntries(entryRows)
    setCategories(categoryRows)
    setEntryCategoryIds(categoryMap)
  }, [showArchived])

  useEffect(() => {
    reload()
  }, [reload])

  const filtered = useMemo(
    () => (typeFilter === 'all' ? entries : entries.filter((e) => e.type === typeFilter)),
    [entries, typeFilter],
  )

  const groups = useMemo(() => {
    if (sortMode === 'newest') {
      return [{ id: 'all', name: null as string | null, entries: [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at)) }]
    }
    const byCategory = new Map<string, { name: string; entries: Entry[] }>()
    const uncategorized: Entry[] = []
    for (const entry of filtered) {
      const ids = entryCategoryIds[entry.id] ?? []
      if (ids.length === 0) {
        uncategorized.push(entry)
        continue
      }
      for (const id of ids) {
        const category = categories.find((c) => c.id === id)
        if (!category) continue
        if (!byCategory.has(id)) byCategory.set(id, { name: category.name, entries: [] })
        byCategory.get(id)!.entries.push(entry)
      }
    }
    const sorted = [...byCategory.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name))
    const result: { id: string; name: string | null; entries: Entry[] }[] = sorted.map(([id, group]) => ({
      id,
      name: group.name,
      entries: group.entries,
    }))
    if (uncategorized.length > 0) result.push({ id: 'uncategorized', name: null, entries: uncategorized })
    return result
  }, [filtered, sortMode, entryCategoryIds, categories])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)]">
      <GlassBackdrop />

      <div className="relative mx-auto flex max-w-md flex-col pb-16">
        <div className="flex items-center justify-between px-5 pb-1 pt-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} aria-label="Back to Home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-[19px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
              Library
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconButton active label="List view">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </IconButton>
            <IconButton label="Grid view (coming soon)">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </IconButton>
            <IconButton label="Calendar view (coming soon)">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </IconButton>
            <button type="button" className="contents" onClick={() => setCaptureSetupOpen(true)}>
              <IconButton label="Shortcuts capture setup">
                <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
              </IconButton>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-5 pb-4 pt-3.5">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setTypeMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-1.5 backdrop-blur-xl"
            >
              <span className="text-xs font-semibold text-[var(--color-text)]">{TYPE_FILTERS.find((t) => t.value === typeFilter)?.label}</span>
              <Chevron />
            </button>
            {typeMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTypeMenuOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-36 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-strong)] p-1 backdrop-blur-2xl">
                  {TYPE_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTypeFilter(option.value)
                        setTypeMenuOpen(false)
                      }}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--color-text)] hover:bg-white/50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSortMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-1.5 backdrop-blur-xl"
            >
              <span className="text-xs font-semibold text-[var(--color-text)]">{sortMode === 'category' ? 'Category, A–Z' : 'Newest first'}</span>
              <Chevron />
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill-strong)] p-1 backdrop-blur-2xl">
                  {(['category', 'newest'] as SortMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSortMode(mode)
                        setSortMenuOpen(false)
                      }}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--color-text)] hover:bg-white/50"
                    >
                      {mode === 'category' ? 'Category, A–Z' : 'Newest first'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <label className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">Archived</span>
            <button
              type="button"
              role="switch"
              aria-checked={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className={`h-[18px] w-8 rounded-full p-0.5 transition-colors ${showArchived ? 'bg-[var(--color-primary)]' : 'bg-black/20'}`}
            >
              <div className={`h-[14px] w-[14px] rounded-full bg-white transition-transform ${showArchived ? 'translate-x-[14px]' : ''}`} />
            </button>
          </label>
        </div>

        <div className="flex flex-col gap-6 px-5">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              {group.name !== undefined && group.name !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[var(--color-text)]">{group.name}</span>
                  <span className="text-xs font-semibold text-[var(--color-text-faint)]">{group.entries.length}</span>
                </div>
              )}
              {group.id === 'uncategorized' && (
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[var(--color-text-muted)]">Uncategorized</span>
                  <span className="text-xs font-semibold text-[var(--color-text-faint)]">{group.entries.length}</span>
                </div>
              )}
              {group.entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                  className={`flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-3 text-left backdrop-blur-xl ${
                    entry.archived_at ? 'opacity-55' : ''
                  }`}
                >
                  {entry.type === 'thought' ? (
                    <div className="mx-[5.5px] h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                  ) : (
                    <div
                      className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${
                        (entry.type === 'task' ? entry.task_status === 'done' : entry.goal_status === 'achieved')
                          ? 'bg-[var(--color-success)]'
                          : 'border-2 border-[var(--color-tertiary)]'
                      }`}
                    >
                      {(entry.type === 'task' ? entry.task_status === 'done' : entry.goal_status === 'achieved') && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-on)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8.5 12.5l2.3 2.3L16 9.5" />
                        </svg>
                      )}
                    </div>
                  )}
                  <span
                    className={`text-sm text-[var(--color-text)] ${entry.type === 'task' && entry.task_status === 'done' ? 'opacity-60 line-through' : ''}`}
                  >
                    {entry.content}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {groups.every((g) => g.entries.length === 0) && (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Nothing here yet.</p>
          )}
        </div>
      </div>

      {selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          userId={session.user.id}
          categories={categories}
          categoryIds={entryCategoryIds[selectedEntry.id] ?? []}
          onClose={() => setSelectedEntry(null)}
          onChanged={reload}
        />
      )}

      {captureSetupOpen && <CaptureSetup userId={session.user.id} onClose={() => setCaptureSetupOpen(false)} />}
    </div>
  )
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function IconButton({ children, active, label }: { children: React.ReactNode; active?: boolean; label: string }) {
  return (
    <div
      aria-label={label}
      title={label}
      className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[var(--glass-border)] backdrop-blur-xl ${
        active ? 'bg-[var(--glass-fill-strong)]' : 'bg-[var(--glass-fill)] opacity-60'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  )
}
