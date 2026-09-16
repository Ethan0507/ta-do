import { supabase } from './supabase'
import type { Entry, EntryType } from '../types'

export const POSITION_GAP = 1024

function todayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function todayRange(): { startISO: string; endISO: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

export async function fetchEntries(includeArchived: boolean): Promise<Entry[]> {
  let query = supabase.from('entries').select('*').order('created_at', { ascending: false })
  if (!includeArchived) {
    query = query.is('archived_at', null)
  }
  const { data, error } = await query
  if (error) throw error
  return data as Entry[]
}

/** Today's active (not-yet-completed) entries of a given type, in manual order. */
export async function fetchTodayEntries(type: EntryType): Promise<Entry[]> {
  let query = supabase
    .from('entries')
    .select('*')
    .eq('type', type)
    .is('archived_at', null)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (type === 'task') {
    const today = todayDateString()
    query = query.eq('task_status', 'open').or(`due_date.is.null,due_date.eq.${today}`)
  } else if (type === 'goal') {
    query = query.eq('goal_status', 'ongoing')
  }

  const { data, error } = await query
  if (error) throw error
  return data as Entry[]
}

/** Entries of a given type completed/achieved today, for the collapsed "completed" strip. */
export async function fetchCompletedToday(type: 'task' | 'goal'): Promise<Entry[]> {
  const { startISO, endISO } = todayRange()
  const statusColumn = type === 'task' ? 'task_status' : 'goal_status'
  const statusValue = type === 'task' ? 'done' : 'achieved'
  const timeColumn = type === 'task' ? 'completed_at' : 'achieved_at'

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('type', type)
    .eq(statusColumn, statusValue)
    .gte(timeColumn, startISO)
    .lt(timeColumn, endISO)
    .order(timeColumn, { ascending: false })
  if (error) throw error
  return data as Entry[]
}

export async function createEntry(
  userId: string,
  type: EntryType,
  content: string,
  dueDate: string | null,
  position: number | null = null,
): Promise<Entry> {
  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: userId,
      type,
      content,
      due_date: dueDate,
      position,
      task_status: type === 'task' ? 'open' : null,
      goal_status: type === 'goal' ? 'ongoing' : null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Entry
}

export async function setArchived(entryId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', entryId)
  if (error) throw error
}

export async function setTaskStatus(entryId: string, status: 'open' | 'done'): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ task_status: status, completed_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', entryId)
  if (error) throw error
}

export async function setGoalStatus(entryId: string, status: 'ongoing' | 'achieved'): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ goal_status: status, achieved_at: status === 'achieved' ? new Date().toISOString() : null })
    .eq('id', entryId)
  if (error) throw error
}

/** Position for a freshly captured entry so it lands at the top of today's list. */
export function getTopPosition(orderedEntries: Entry[]): number {
  const top = orderedEntries[0]?.position
  return (top ?? POSITION_GAP) - POSITION_GAP
}

/** Fractional position for an entry that just landed at `index` in a freshly reordered array. */
export function computeReorderedPosition(orderedEntries: Entry[], index: number): number {
  const prev = orderedEntries[index - 1]?.position ?? null
  const next = orderedEntries[index + 1]?.position ?? null
  if (prev === null && next === null) return 0
  if (prev === null) return next! - POSITION_GAP
  if (next === null) return prev + POSITION_GAP
  return (prev + next) / 2
}

export async function updateEntryPosition(entryId: string, position: number): Promise<void> {
  const { error } = await supabase.from('entries').update({ position }).eq('id', entryId)
  if (error) throw error
}

export async function updateEntryType(entryId: string, type: EntryType): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({
      type,
      task_status: type === 'task' ? 'open' : null,
      completed_at: null,
      goal_status: type === 'goal' ? 'ongoing' : null,
      achieved_at: null,
    })
    .eq('id', entryId)
  if (error) throw error
}

export async function updateEntryContent(entryId: string, content: string): Promise<void> {
  const { error } = await supabase.from('entries').update({ content }).eq('id', entryId)
  if (error) throw error
}

export async function updateEntryNotes(entryId: string, notes: string): Promise<void> {
  const { error } = await supabase.from('entries').update({ notes: notes || null }).eq('id', entryId)
  if (error) throw error
}

export async function updateEntryDueDate(entryId: string, dueDate: string | null): Promise<void> {
  const { error } = await supabase.from('entries').update({ due_date: dueDate }).eq('id', entryId)
  if (error) throw error
}

export async function findRecentEntryByContent(content: string, sinceISO: string): Promise<Entry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('content', content)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Entry | null
}

export async function fetchEntryCategoryIds(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase.from('entry_categories').select('entry_id, category_id')
  if (error) throw error
  const map: Record<string, string[]> = {}
  for (const row of data) {
    if (!map[row.entry_id]) map[row.entry_id] = []
    map[row.entry_id].push(row.category_id)
  }
  return map
}

export async function setEntryCategories(entryId: string, categoryIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from('entry_categories').delete().eq('entry_id', entryId)
  if (deleteError) throw deleteError
  if (categoryIds.length === 0) return
  const { error: insertError } = await supabase
    .from('entry_categories')
    .insert(categoryIds.map((category_id) => ({ entry_id: entryId, category_id })))
  if (insertError) throw insertError
}
