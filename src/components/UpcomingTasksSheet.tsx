import { useEffect, useRef, useState } from 'react'
import { LeadingActions, SwipeAction, SwipeableListItem, Type } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import type { Entry } from '../types'
import { fetchUpcomingTasks, setTaskStatus, UPCOMING_TASKS_PAGE_SIZE } from '../lib/entries'

interface UpcomingTasksSheetProps {
  onClose: () => void
  onChanged: () => void
  onOpenEntry: (entry: Entry) => void
}

function dateGroupLabel(dueDate: string | null): string {
  if (!dueDate) return 'No due date'
  const due = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function groupByDate(tasks: Entry[]): { label: string; items: Entry[] }[] {
  const groups: { label: string; items: Entry[] }[] = []
  for (const task of tasks) {
    const label = dateGroupLabel(task.due_date)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(task)
    else groups.push({ label, items: [task] })
  }
  return groups
}

export function UpcomingTasksSheet({ onClose, onChanged, onOpenEntry }: UpcomingTasksSheetProps) {
  const [tasks, setTasks] = useState<Entry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const scrolledRef = useRef(false)

  useEffect(() => {
    fetchUpcomingTasks(0).then((page) => {
      setTasks(page)
      setHasMore(page.length === UPCOMING_TASKS_PAGE_SIZE)
      setLoaded(true)
    })
  }, [])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const page = await fetchUpcomingTasks(tasks.length)
    setTasks((prev) => [...prev, ...page])
    setHasMore(page.length === UPCOMING_TASKS_PAGE_SIZE)
    setLoadingMore(false)
  }

  async function handleCheck(entryId: string) {
    await setTaskStatus(entryId, 'done')
    setTasks((prev) => prev.filter((t) => t.id !== entryId))
    onChanged()
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (!scrolledRef.current && el.scrollTop > 8) {
      scrolledRef.current = true
      setExpanded(true)
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore()
    }
  }

  const groups = groupByDate(tasks)

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md flex-col border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl transition-[height] duration-300 ease-out"
      style={{ height: expanded ? '100vh' : '48vh', borderTopLeftRadius: expanded ? 0 : 28, borderTopRightRadius: expanded ? 0 : 28 }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="relative flex shrink-0 items-center justify-center py-3.5"
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        <div className="h-1 w-9 rounded-full bg-black/20" />
      </button>

      <div className="flex shrink-0 items-center justify-between px-5 pb-3">
        <span className="text-[15px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          Upcoming tasks
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
          aria-label="Close"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8" onScroll={handleScroll}>
        {loaded && tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No open tasks.</p>
        )}
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <span className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-faint)]">
                {group.label}
              </span>
              <div className="divide-y divide-[var(--glass-border)]">
                {group.items.map((task) => (
                  <SwipeableListItem
                    key={task.id}
                    listType={Type.IOS}
                    fullSwipe
                    threshold={0.3}
                    onClick={() => onOpenEntry(task)}
                    leadingActions={
                      <LeadingActions>
                        <SwipeAction onClick={() => handleCheck(task.id)}>
                          <div className="flex h-full items-center gap-2 bg-[var(--color-success)] pl-5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-on)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 12.5l2.5 2.5L16 9.5" />
                            </svg>
                            <span className="text-[12.5px] font-bold text-[var(--color-primary-on)]">Done</span>
                          </div>
                        </SwipeAction>
                      </LeadingActions>
                    }
                  >
                    <div className="flex w-full cursor-pointer items-center gap-3 py-2.5">
                      <div className="h-[17px] w-[17px] shrink-0 rounded-full border-2 border-[var(--color-tertiary)]" />
                      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--color-text)]">{task.content}</p>
                    </div>
                  </SwipeableListItem>
                ))}
              </div>
            </div>
          ))}
        </div>
        {loadingMore && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Loading more…</p>}
      </div>
    </div>
  )
}
