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
  getTopPositionsForBatch,
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
import { AccountSettings } from '../components/AccountSettings'

interface HomeProps {
  session: Session
  onOpenLibrary: () => void
  onOpenTemplate: (template: Entry) => void
  refreshKey: number
  onTimezoneChanged: () => void
  theme: {
    preference: ThemePreference
    setPreference: (preference: ThemePreference) => void
  }
}

export function Home({ session, onOpenLibrary, onOpenTemplate, refreshKey, onTimezoneChanged, theme }: HomeProps) {
  const [type, setType] = useState<EntryType>('thought')
  const [entries, setEntries] = useState<Entry[]>([])
  const [completedEntries, setCompletedEntries] = useState<Entry[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [entryCategoryIds, setEntryCategoryIds] = useState<Record<string, string[]>>({})
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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
  }, [reload, refreshKey])

  async function handleCapture(content: string) {
    await createEntry(session.user.id, type, content, null, getTopPosition(entries))
    await reload()
  }

  async function handleCaptureMany(contents: string[]) {
    const positions = getTopPositionsForBatch(entries, contents.length)
    for (let i = 0; i < contents.length; i++) {
      await createEntry(session.user.id, type, contents[i], null, positions[i])
    }
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
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] backdrop-blur-xl"
              aria-label="Account settings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
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

      <CaptureFab type={type} onCapture={handleCapture} onCaptureMany={handleCaptureMany} />

      {showUpcoming && (
        <UpcomingTasksSheet onClose={() => setShowUpcoming(false)} onChanged={reload} onOpenEntry={setSelectedEntry} />
      )}

      {showSettings && (
        <AccountSettings
          userId={session.user.id}
          themePreference={theme.preference}
          onThemeChange={theme.setPreference}
          onTimezoneChanged={onTimezoneChanged}
          onClose={() => setShowSettings(false)}
        />
      )}

      {selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          userId={session.user.id}
          categories={categories}
          categoryIds={entryCategoryIds[selectedEntry.id] ?? []}
          onClose={() => setSelectedEntry(null)}
          onChanged={reload}
          onOpenTemplate={onOpenTemplate}
        />
      )}
    </div>
  )
}
