import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Category, Entry, EntryType } from '../types'
import {
  createEntry,
  fetchEntries,
  fetchEntryCategoryIds,
  setArchived,
  setEntryCategories,
  setGoalStatus,
  setTaskStatus,
} from '../lib/entries'
import { createCategory, fetchCategories } from '../lib/categories'
import { Capture } from '../components/Capture'
import { RollupSummary } from '../components/RollupSummary'
import { EntryList } from '../components/EntryList'

interface HomeProps {
  session: Session
}

export function Home({ session }: HomeProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [entryCategoryIds, setEntryCategoryIds] = useState<Record<string, string[]>>({})
  const [showArchived, setShowArchived] = useState(false)

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

  async function handleCapture(type: EntryType, content: string, dueDate: string | null) {
    await createEntry(session.user.id, type, content, dueDate)
    await reload()
  }

  async function handleArchive(entryId: string, archived: boolean) {
    await setArchived(entryId, archived)
    await reload()
  }

  async function handleSetTaskStatus(entryId: string, status: 'open' | 'done') {
    await setTaskStatus(entryId, status)
    await reload()
  }

  async function handleSetGoalStatus(entryId: string, status: 'ongoing' | 'achieved') {
    await setGoalStatus(entryId, status)
    await reload()
  }

  async function handleChangeCategories(entryId: string, categoryIds: string[]) {
    await setEntryCategories(entryId, categoryIds)
    await reload()
  }

  async function handleCreateCategory(name: string) {
    await createCategory(session.user.id, name)
    await reload()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Ta-do</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-400 hover:text-slate-700">
          Sign out
        </button>
      </div>
      <Capture onCapture={handleCapture} />
      <RollupSummary entries={entries} />
      <EntryList
        entries={entries}
        categories={categories}
        entryCategoryIds={entryCategoryIds}
        showArchived={showArchived}
        onToggleShowArchived={setShowArchived}
        onArchive={handleArchive}
        onSetTaskStatus={handleSetTaskStatus}
        onSetGoalStatus={handleSetGoalStatus}
        onChangeCategories={handleChangeCategories}
        onCreateCategory={handleCreateCategory}
      />
    </div>
  )
}
