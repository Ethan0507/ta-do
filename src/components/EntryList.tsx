import { useMemo, useState } from 'react'
import type { Category, Entry, EntryType } from '../types'
import { CategoryPicker } from './CategoryPicker'

type SortField = 'created_at' | 'type' | 'due_date'

interface EntryListProps {
  entries: Entry[]
  categories: Category[]
  entryCategoryIds: Record<string, string[]>
  showArchived: boolean
  onToggleShowArchived: (value: boolean) => void
  onArchive: (entryId: string, archived: boolean) => void
  onSetTaskStatus: (entryId: string, status: 'open' | 'done') => void
  onSetGoalStatus: (entryId: string, status: 'ongoing' | 'achieved') => void
  onChangeCategories: (entryId: string, categoryIds: string[]) => void
  onCreateCategory: (name: string) => Promise<void>
}

export function EntryList({
  entries,
  categories,
  entryCategoryIds,
  showArchived,
  onToggleShowArchived,
  onArchive,
  onSetTaskStatus,
  onSetGoalStatus,
  onChangeCategories,
  onCreateCategory,
}: EntryListProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')

  const visible = useMemo(() => {
    let result = entries
    if (typeFilter !== 'all') result = result.filter((e) => e.type === typeFilter)
    return [...result].sort((a, b) => {
      if (sortField === 'type') return a.type.localeCompare(b.type)
      if (sortField === 'due_date') return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      return b.created_at.localeCompare(a.created_at)
    })
  }, [entries, sortField, typeFilter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EntryType | 'all')} className="rounded border border-slate-300 px-2 py-1">
          <option value="all">All types</option>
          <option value="thought">Thought</option>
          <option value="goal">Goal</option>
          <option value="task">Task</option>
        </select>
        <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} className="rounded border border-slate-300 px-2 py-1">
          <option value="created_at">Sort: newest first</option>
          <option value="type">Sort: type</option>
          <option value="due_date">Sort: due date</option>
        </select>
        <label className="ml-auto flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => onToggleShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="space-y-2">
        {visible.map((entry) => (
          <div key={entry.id} className={`rounded-lg bg-white p-3 shadow ${entry.archived_at ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{entry.type}</span>
                  {entry.due_date && <span className="text-xs text-slate-400">due {entry.due_date}</span>}
                </div>
                <p className="mt-1 text-sm text-slate-900">{entry.content}</p>
                <div className="mt-2">
                  <CategoryPicker
                    allCategories={categories}
                    selectedIds={entryCategoryIds[entry.id] ?? []}
                    onChange={(ids) => onChangeCategories(entry.id, ids)}
                    onCreateCategory={onCreateCategory}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {entry.type === 'task' && (
                  <button
                    onClick={() => onSetTaskStatus(entry.id, entry.task_status === 'done' ? 'open' : 'done')}
                    className={`rounded px-2 py-0.5 text-xs ${entry.task_status === 'done' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {entry.task_status === 'done' ? 'Done' : 'Mark done'}
                  </button>
                )}
                {entry.type === 'goal' && (
                  <button
                    onClick={() => onSetGoalStatus(entry.id, entry.goal_status === 'achieved' ? 'ongoing' : 'achieved')}
                    className={`rounded px-2 py-0.5 text-xs ${entry.goal_status === 'achieved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {entry.goal_status === 'achieved' ? 'Achieved' : 'Mark achieved'}
                  </button>
                )}
                <button onClick={() => onArchive(entry.id, !entry.archived_at)} className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-700">
                  {entry.archived_at ? 'Unarchive' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p className="text-sm text-slate-400">Nothing here yet.</p>}
      </div>
    </div>
  )
}
