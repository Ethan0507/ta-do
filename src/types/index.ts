export type EntryType = 'thought' | 'goal' | 'task'
export type TaskStatus = 'open' | 'done'
export type GoalStatus = 'ongoing' | 'achieved'
export type PeriodScope = 'week' | 'month' | 'year'
export type ThemePreference = 'light' | 'dark' | 'auto'
export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'custom'

export type RecurrenceRule =
  | { freq: 'daily' }
  | { freq: 'weekly'; weekday: number } // 0 = Sunday .. 6 = Saturday
  | { freq: 'monthly'; day_of_month: number }
  | { freq: 'custom'; weekdays: number[]; times: string[] } // times as "HH:MM"

export interface Habit {
  id: string
  user_id: string
  title: string
  recurrence_rule: RecurrenceRule
  created_at: string
}

export interface Routine {
  id: string
  user_id: string
  created_at: string
}

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
  notes: string | null
  created_at: string
  archived_at: string | null
  habit_id: string | null
  position: number | null

  // Task-specific
  due_date: string | null
  due_time: string | null
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
