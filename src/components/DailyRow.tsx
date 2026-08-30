import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LeadingActions, SwipeAction, SwipeableListItem, Type } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import type { Entry } from '../types'

interface DailyRowProps {
  entry: Entry
  checkable: boolean
  onCheck: () => void
  onOpen: () => void
}

export function DailyRow({ entry, checkable, onCheck, onOpen }: DailyRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      onClick={checkable ? undefined : onOpen}
      className={`flex w-full items-center gap-3 rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-3.5 shadow-[var(--glass-shadow)] backdrop-blur-xl ${
        checkable ? '' : 'cursor-pointer'
      }`}
    >
      {entry.type === 'thought' ? (
        <div className="mx-[6.5px] h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
      ) : (
        <div className="h-[21px] w-[21px] shrink-0 rounded-full border-2 border-[var(--color-tertiary)]" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-[var(--color-text)]">{entry.content}</p>
        {entry.due_date && <p className="text-[11.5px] text-[var(--color-text-muted)]">Due {entry.due_date}</p>}
      </div>

      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 touch-none text-[var(--color-text-muted)]"
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" />
          <circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" />
          <circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" />
        </svg>
      </button>
    </div>
  )

  if (!checkable) return card

  return (
    <SwipeableListItem
      listType={Type.IOS}
      fullSwipe
      threshold={0.3}
      onClick={onOpen}
      leadingActions={
        <LeadingActions>
          <SwipeAction onClick={onCheck}>
            <div className="flex h-full items-center gap-2 rounded-[20px] bg-[var(--color-success)] pl-5">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-on)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 12.5l2.5 2.5L16 9.5" />
              </svg>
              <span className="text-[13px] font-bold text-[var(--color-primary-on)]">Done</span>
            </div>
          </SwipeAction>
        </LeadingActions>
      }
    >
      {card}
    </SwipeableListItem>
  )
}
