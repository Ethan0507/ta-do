import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Entry, EntryType } from '../types'
import { DailyRow } from './DailyRow'

interface DailyListProps {
  entries: Entry[]
  completedEntries: Entry[]
  type: EntryType
  showCompleted: boolean
  onToggleCompleted: () => void
  onCheck: (entryId: string) => void
  onReorder: (activeId: string, overId: string) => void
  onOpenEntry: (entry: Entry) => void
}

export function DailyList({
  entries,
  completedEntries,
  type,
  showCompleted,
  onToggleCompleted,
  onCheck,
  onReorder,
  onOpenEntry,
}: DailyListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const checkable = type !== 'thought'

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {checkable && completedEntries.length > 0 && (
        <CompletedStrip
          count={completedEntries.length}
          expanded={showCompleted}
          onToggle={onToggleCompleted}
          entries={completedEntries}
          onOpenEntry={onOpenEntry}
        />
      )}

      <div className="px-5 pt-1.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Today</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3 px-5">
            {entries.map((entry) => (
              <DailyRow
                key={entry.id}
                entry={entry}
                checkable={checkable}
                onCheck={() => onCheck(entry.id)}
                onOpen={() => onOpenEntry(entry)}
              />
            ))}
            {entries.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <p className="text-sm font-bold text-[var(--color-text)]">Today's clear.</p>
                <p className="text-[13px] text-[var(--color-text-muted)]">Capture a thought before it slips —</p>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-1 rotate-90"
                  aria-hidden="true"
                >
                  <path d="M7 17L17 7M17 7H9M17 7V15" />
                </svg>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function CompletedStrip({
  count,
  expanded,
  onToggle,
  entries,
  onOpenEntry,
}: {
  count: number
  expanded: boolean
  onToggle: () => void
  entries: Entry[]
  onOpenEntry: (entry: Entry) => void
}) {
  return (
    <div className="mx-5 flex flex-col gap-2 rounded-[20px] bg-[var(--glass-fill)] p-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between rounded-full px-3.5 py-2.5"
      >
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
          </svg>
          <span className="text-[12.5px] font-bold text-[var(--color-text)]">{count} completed today</span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`opacity-55 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 px-2 pb-2">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onOpenEntry(entry)}
              className="rounded-2xl bg-white/40 px-3.5 py-2.5 text-left"
            >
              <p className="text-[13.5px] font-medium text-[var(--color-text-muted)] line-through decoration-[var(--color-text-faint)]">
                {entry.content}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
