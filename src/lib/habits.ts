import { supabase } from './supabase'
import type { Entry, Habit, RecurrenceRule } from '../types'

export async function fetchHabit(habitId: string): Promise<Habit | null> {
  const { data, error } = await supabase.from('habits').select('*').eq('id', habitId).maybeSingle()
  if (error) throw error
  return data as Habit | null
}

/** The entry that represents a Habit's series definition (undated, hidden from daily/upcoming views). */
export async function fetchRecurrenceTemplate(habitId: string): Promise<Entry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('habit_id', habitId)
    .eq('is_recurrence_template', true)
    .maybeSingle()
  if (error) throw error
  return data as Entry | null
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

    // The entry being turned into a repeat becomes the series' template from here on,
    // not an occurrence itself — undated, excluded from daily/upcoming views (only the
    // generator's dated occurrences show there), and it's the one row Library shows to
    // represent the whole series.
    const { error: linkError } = await supabase
      .from('entries')
      .update({ habit_id: habitId, is_recurrence_template: true, due_date: null, due_time: null })
      .eq('id', entryId)
    if (linkError) throw linkError
  }

  const { error: upsertError } = await supabase.from('routine_habits').upsert({ routine_id: routineId, habit_id: habitId })
  if (upsertError) throw upsertError

  if (!existingHabitId) {
    // Best-effort: run the generator immediately so today's occurrence appears right
    // away instead of waiting for the next scheduled tick (up to 15 minutes).
    try {
      await supabase.rpc('generate_habit_entries')
    } catch {
      // ignore — the scheduled job will still pick it up within 15 minutes
    }
  }
}
