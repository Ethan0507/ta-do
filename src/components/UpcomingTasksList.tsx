import { useEffect, useRef, useState } from 'react'
import { LeadingActions, SwipeAction, SwipeableListItem, Type } from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import type { Entry } from '../types'
import { fetchUpcomingTasks, setTaskStatus, UPCOMING_TASKS_PAGE_SIZE } from '../lib/entries'

interface UpcomingTasksListProps {
  onBack: () => void
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

export function UpcomingTasksList({ onBack, onChanged, onOpenEntry }: UpcomingTasksListProps) {
  const [tasks, setTasks] = useState<Entry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchUpcomingTasks(0).then((page) => {
      setTasks(page)
      setHasMore(page.length === UPCOMING_TASKS_PAGE_SIZE)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length, hasMore, loadingMore])

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

  const groups = groupByDate(tasks)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-5 pt-1.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Upcoming</span>
        <button type="button" onClick={onBack} className="text-xs font-bold text-[var(--color-primary)] underline underline-offset-2">
          Back to today
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5">
        {loaded && tasks.length === 0 && <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No open tasks.</p>}
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-faint)]">{group.label}</span>
            <div className="flex flex-col gap-2">
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
                  <div className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-3.5 shadow-[var(--glass-shadow)] backdrop-blur-xl">
                    <div className="h-[21px] w-[21px] shrink-0 rounded-full border-2 border-[var(--color-tertiary)]" />
                    <p className="min-w-0 flex-1 text-[14.5px] font-semibold text-[var(--color-text)]">{task.content}</p>
                  </div>
                </SwipeableListItem>
              ))}
            </div>
          </div>
        ))}
        <div ref={sentinelRef} />
        {loadingMore && <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">Loading more…</p>}
      </div>
    </div>
  )
}
