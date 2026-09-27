import { supabase } from './supabase'
import type { Habit, RecurrenceRule } from '../types'

export async function fetchHabit(habitId: string): Promise<Habit | null> {
  const { data, error } = await supabase.from('habits').select('*').eq('id', habitId).maybeSingle()
  if (error) throw error
  return data as Habit | null
}

/** Which of the given habit ids are currently active (a member of their user's Routine). */
export async function fetchActiveHabitIds(habitIds: string[]): Promise<Set<string>> {
  if (habitIds.length === 0) return new Set()
  const { data, error } = await supabase.from('routine_habits').select('habit_id').in('habit_id', habitIds)
  if (error) throw error
  return new Set(data.map((row) => row.habit_id as string))
}

async function getOrCreateRoutineId(userId: string): Promise<string> {
  const { data, error } = await supabase.from('routines').select('id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return data.id
  const { data: created, error: createError } = await supabase
    .from('routines')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (createError) throw createError
  return created.id
}

/**
 * Applies (or clears) a recurrence rule on a task entry.
 * Creates the linked Habit on first use, otherwise updates it in place, and
 * adds/removes it from the user's Routine to mark it active/paused.
 */
export async function setEntryRecurrence(
  entryId: string,
  userId: string,
  title: string,
  rule: RecurrenceRule | null,
  existingHabitId: string | null,
): Promise<void> {
  const routineId = await getOrCreateRoutineId(userId)

  if (!rule) {
    if (existingHabitId) {
      const { error } = await supabase
        .from('routine_habits')
        .delete()
        .eq('routine_id', routineId)
        .eq('habit_id', existingHabitId)
      if (error) throw error
    }
    return
  }

  let habitId = existingHabitId
  if (habitId) {
    const { error } = await supabase.from('habits').update({ title, recurrence_rule: rule }).eq('id', habitId)
    if (error) throw error
  } else {
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: userId, title, recurrence_rule: rule })
      .select('id')
      .single()
    if (error) throw error
    habitId = data.id
    const { error: linkError } = await supabase.from('entries').update({ habit_id: habitId }).eq('id', entryId)
    if (linkError) throw linkError
  }

  const { error: upsertError } = await supabase.from('routine_habits').upsert({ routine_id: routineId, habit_id: habitId })
  if (upsertError) throw upsertError
}
