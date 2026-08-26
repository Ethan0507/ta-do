import type { Entry } from '../types'

interface RollupSummaryProps {
  entries: Entry[]
}

export function RollupSummary({ entries }: RollupSummaryProps) {
  const tasks = entries.filter((e) => e.type === 'task')
  const goals = entries.filter((e) => e.type === 'goal')
  const tasksDone = tasks.filter((t) => t.task_status === 'done').length
  const goalsAchieved = goals.filter((g) => g.goal_status === 'achieved').length

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-white p-3 shadow">
        <p className="text-xs uppercase tracking-wide text-slate-500">Tasks</p>
        <p className="text-lg font-semibold text-slate-900">
          {tasksDone} / {tasks.length} done
        </p>
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <p className="text-xs uppercase tracking-wide text-slate-500">Goals</p>
        <p className="text-lg font-semibold text-slate-900">
          {goalsAchieved} / {goals.length} achieved
        </p>
      </div>
    </div>
  )
}
