export type EntryType = 'thought' | 'goal' | 'task'
export type TaskStatus = 'open' | 'done'
export type GoalStatus = 'ongoing' | 'achieved'
export type PeriodScope = 'week' | 'month' | 'year'

export interface Category {
  id: string
  user_id: string | null
  name: string
  created_at: string
}

export interface Entry {
  id: string
  user_id: string
  type: EntryType
  content: string
  created_at: string
  archived_at: string | null
  habit_id: string | null
  position: number | null

  // Task-specific
  due_date: string | null
  priority: number | null
  task_status: TaskStatus | null
  completed_at: string | null

  // Goal-specific
  period_scope: PeriodScope | null
  period_identifier: string | null
  target_metric: string | null
  goal_status: GoalStatus | null
  achieved_at: string | null
}

export interface EntryCategory {
  entry_id: string
  category_id: string
}
