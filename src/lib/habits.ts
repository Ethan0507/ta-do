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

/** Creates today's tasks from the current user's repeating templates (and marks past ones missed). Safe to call repeatedly. */
export async function generateTodaysTasks(): Promise<void> {
  const { error } = await supabase.rpc('generate_habit_entries')
  if (error) throw error
}

/**
 * Applies (or clears) a recurrence rule on a task entry.
 * - First rule: creates the Habit, turns the entry into the template, makes it active.
 * - Changed rule/title: updates the Habit; only tasks generated from now on pick it up.
 * - Cleared rule: deletes the Habit and turns the template back into a normal task.
 *   Already-generated tasks are untouched (and stay out of Library via is_generated).
 */
export async function setEntryRecurrence(
  entryId: string,
  userId: string,
  title: string,
  rule: RecurrenceRule | null,
  existingHabitId: string | null,
): Promise<void> {
  if (!rule) {
    if (!existingHabitId) return
    const { error: entryError } = await supabase
      .from('entries')
      .update({ is_recurrence_template: false, habit_id: null })
      .eq('id', entryId)
    if (entryError) throw entryError
    const { error } = await supabase.from('habits').delete().eq('id', existingHabitId)
    if (error) throw error
    return
  }

  if (existingHabitId) {
    const { error } = await supabase.from('habits').update({ title, recurrence_rule: rule }).eq('id', existingHabitId)
    if (error) throw error
    return
  }

  const routineId = await getOrCreateRoutineId(userId)
  const { data, error } = await supabase
    .from('habits')
    .insert({ user_id: userId, title, recurrence_rule: rule })
    .select('id')
    .single()
  if (error) throw error
  const habitId = data.id

  // Only link if the entry isn't already a template — a double-tapped Save must not
  // leave two Habits behind for one task (that's how "Wake up" ended up generating 3x/day).
  const { data: linked, error: linkError } = await supabase
    .from('entries')
    .update({
      habit_id: habitId,
      is_recurrence_template: true,
      due_date: null,
      due_time: null,
      task_status: 'open',
      completed_at: null,
    })
    .eq('id', entryId)
    .is('habit_id', null)
    .select('id')
  if (linkError) throw linkError
  if (linked.length === 0) {
    await supabase.from('habits').delete().eq('id', habitId)
    return
  }

  const { error: routineError } = await supabase.from('routine_habits').insert({ routine_id: routineId, habit_id: habitId })
  if (routineError) throw routineError

  // Today's task appears right away if today matches, instead of at the next scheduled run.
  await generateTodaysTasks().catch(() => {})
}
