import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Category, Entry, EntryType, ThemePreference } from '../types'
import {
  computeReorderedPosition,
  createEntry,
  fetchCompletedToday,
  fetchEntryCategoryIds,
  fetchTodayEntries,
  getTopPosition,
  setGoalStatus,
  setTaskStatus,
  updateEntryPosition,
} from '../lib/entries'
import { fetchCategories } from '../lib/categories'
import { GlassBackdrop } from '../components/GlassBackdrop'
import { Logomark } from '../components/Logomark'
import { TypeSelector } from '../components/TypeSelector'
import { DailyList } from '../components/DailyList'
import { CaptureFab } from '../components/CaptureFab'
import { EntryDetail } from '../components/EntryDetail'
import { UpcomingTasksSheet } from '../components/UpcomingTasksSheet'

interface HomeProps {
  session: Session
  onOpenLibrary: () => void
  theme: {
    preference: ThemePreference
    resolvedTheme: 'light' | 'dark'
    setPreference: (preference: ThemePreference) => void
    toggle: () => void
  }
}

export function Home({ session, onOpenLibrary, theme }: HomeProps) {
  const [type, setType] = useState<EntryType>('thought')
  const [entries, setEntries] = useState<Entry[]>([])
  const [completedEntries, setCompletedEntries] = useState<Entry[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [entryCategoryIds, setEntryCategoryIds] = useState<Record<string, string[]>>({})
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [showUpcoming, setShowUpcoming] = useState(false)

  const reload = useCallback(async () => {
    const [todayEntries, categoryRows, categoryMap] = await Promise.all([
      fetchTodayEntries(type),
      fetchCategories(),
      fetchEntryCategoryIds(),
    ])
    setEntries(todayEntries)
    setCategories(categoryRows)
    setEntryCategoryIds(categoryMap)
    if (type === 'thought') {
      setCompletedEntries([])
    } else {
      setCompletedEntries(await fetchCompletedToday(type))
    }
  }, [type])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleCapture(content: string) {
    await createEntry(session.user.id, type, content, null, getTopPosition(entries))
    await reload()
  }

  async function handleCheck(entryId: string) {
    if (type === 'task') await setTaskStatus(entryId, 'done')
    else if (type === 'goal') await setGoalStatus(entryId, 'achieved')
    await reload()
  }

  async function handleReorder(activeId: string, overId: string) {
    const oldIndex = entries.findIndex((e) => e.id === activeId)
    const newIndex = entries.findIndex((e) => e.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...entries]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setEntries(reordered)

    const position = computeReorderedPosition(reordered, newIndex)
    await updateEntryPosition(activeId, position)
    await reload()
  }

  return (
    <div className="app-shell relative min-h-screen overflow-hidden">
      <GlassBackdrop />

      <div className="relative mx-auto flex max-w-md flex-col pb-28">
        <div className="flex items-center justify-between px-5 pb-1.5 pt-6">
          <div className="flex items-center gap-2.5">
            <Logomark />
            <span className="text-[17px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
              Ta-do
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={theme.toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] backdrop-blur-xl"
              aria-label={`Theme: ${theme.preference}`}
            >
              {theme.preference === 'dark' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4.5" />
                  <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                </svg>
              ) : theme.preference === 'light' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="var(--color-text)" stroke="none" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] backdrop-blur-xl"
              aria-label="Open library"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="15" height="15" rx="3" />
                <path d="M8 3v3M14 3v3M3 10h15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] backdrop-blur-xl"
              aria-label="Sign out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 pt-3.5">
          <TypeSelector value={type} onChange={setType} />
        </div>

        <div className="mt-4">
          <DailyList
            entries={entries}
            completedEntries={completedEntries}
            type={type}
            showCompleted={showCompleted}
            onToggleCompleted={() => setShowCompleted((s) => !s)}
            onCheck={handleCheck}
            onReorder={handleReorder}
            onOpenEntry={setSelectedEntry}
            onShowUpcoming={() => setShowUpcoming(true)}
          />
        </div>
      </div>

      <CaptureFab type={type} onCapture={handleCapture} />

      {showUpcoming && (
        <UpcomingTasksSheet onClose={() => setShowUpcoming(false)} onChanged={reload} onOpenEntry={setSelectedEntry} />
      )}

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
    </div>
  )
}
