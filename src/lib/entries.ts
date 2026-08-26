import { supabase } from './supabase'
import type { Entry, EntryType } from '../types'

export async function fetchEntries(includeArchived: boolean): Promise<Entry[]> {
  let query = supabase.from('entries').select('*').order('created_at', { ascending: false })
  if (!includeArchived) {
    query = query.is('archived_at', null)
  }
  const { data, error } = await query
  if (error) throw error
  return data as Entry[]
}

export async function createEntry(userId: string, type: EntryType, content: string, dueDate: string | null): Promise<Entry> {
  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: userId,
      type,
      content,
      due_date: dueDate,
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
