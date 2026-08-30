import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Entry, EntryType } from '../types'
import {
  computeReorderedPosition,
  createEntry,
  fetchCompletedToday,
  fetchTodayEntries,
  getTopPosition,
  setGoalStatus,
  setTaskStatus,
  updateEntryPosition,
} from '../lib/entries'
import { GlassBackdrop } from '../components/GlassBackdrop'
import { TypeSelector } from '../components/TypeSelector'
import { DailyList } from '../components/DailyList'
import { CaptureFab } from '../components/CaptureFab'

interface HomeProps {
  session: Session
  onOpenLibrary: () => void
}

export function Home({ session, onOpenLibrary }: HomeProps) {
  const [type, setType] = useState<EntryType>('thought')
  const [entries, setEntries] = useState<Entry[]>([])
  const [completedEntries, setCompletedEntries] = useState<Entry[]>([])
  const [showCompleted, setShowCompleted] = useState(false)

  const reload = useCallback(async () => {
    const todayEntries = await fetchTodayEntries(type)
    setEntries(todayEntries)
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)]">
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
          />
        </div>
      </div>

      <CaptureFab type={type} onCapture={handleCapture} />
    </div>
  )
}

function Logomark() {
  return (
    <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
      <circle cx="22" cy="25" r="16" fill="oklch(100% 0 0 / 0.55)" />
      <circle cx="35" cy="19" r="11" fill="oklch(100% 0 0 / 0.4)" />
      <circle cx="29" cy="35" r="9" fill="oklch(100% 0 0 / 0.3)" />
      <circle cx="25" cy="27" r="5.5" fill="var(--color-primary)" />
    </svg>
  )
}
