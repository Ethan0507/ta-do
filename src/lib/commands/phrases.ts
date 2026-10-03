// The user's voice/typed command phrases — shared with the iOS app through `voice_phrases`
// (migration 0014): only their changes are stored ('custom' phrases and 'disabled_default'
// switches); effective = defaults − disabled + custom.
import { supabase } from '../supabase'
import { effectivePhrases, type CommandAction, type CommandPhrase } from './parser'

export interface PhraseRow {
  id: string
  action: CommandAction
  phrase: string
  kind: 'custom' | 'disabled_default'
}

const CACHE_KEY = 'ta-do-voice-phrases'

/** Last loaded rows, so typed capture works before the network answers. */
export function cachedPhraseRows(): PhraseRow[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as PhraseRow[]
  } catch {
    return []
  }
}

function cache(rows: PhraseRow[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  } catch {
    // private mode / blocked storage — fine, we just refetch next time
  }
}

export async function fetchPhraseRows(): Promise<PhraseRow[]> {
  const { data, error } = await supabase.from('voice_phrases').select('id, action, phrase, kind').order('created_at')
  if (error) throw error
  cache(data as PhraseRow[])
  return data as PhraseRow[]
}

export function phrasesFrom(rows: PhraseRow[]): CommandPhrase[] {
  return effectivePhrases(
    rows.filter((r) => r.kind === 'disabled_default').map(({ action, phrase }) => ({ action, phrase })),
    rows.filter((r) => r.kind === 'custom').map(({ action, phrase }) => ({ action, phrase })),
  )
}

export const ACTION_INFO: Record<CommandAction, { title: string; explanation: string; example: string }> = {
  task: { title: 'Task', explanation: 'Makes the entry a task. Plain “task” only counts at the start.', example: 'Task call the electrician' },
  thought: { title: 'Thought', explanation: 'Makes the entry a thought.', example: 'Thought maybe switch desks' },
  goal: { title: 'Goal', explanation: 'Makes the entry a goal.', example: 'New goal run a half marathon' },
  label: { title: 'Label', explanation: 'Adds the words after it as labels (“and” for several).', example: 'Plan the trip label as travel' },
  repeating: { title: 'Repeat', explanation: 'Makes it a repeating task — daily, weekdays, every Monday, monthly…', example: 'Stretch every weekday at 7 am' },
  due: { title: 'Due date', explanation: 'Sets a due date. Dates like “tomorrow at 6” also work without it.', example: 'Send the invoice due Friday' },
  note: { title: 'Note', explanation: "Everything after it becomes the entry's note. Say it last.", example: 'Book the dentist with a note ask about whitening' },
  next: { title: 'Next entry', explanation: 'Starts another entry in the same capture.', example: 'Buy milk next item call mom' },
}

export async function addCustomPhrase(userId: string, rows: PhraseRow[], action: CommandAction, raw: string): Promise<PhraseRow> {
  const phrase = raw.trim().toLowerCase()
  if (!phrase) throw new Error('Type a phrase first.')
  if (phrase.length > 40) throw new Error('Keep phrases under 40 characters.')
  const clash = phrasesFrom(rows).find((p) => p.phrase.toLowerCase() === phrase)
  if (clash) throw new Error(`That phrase is already used for ${ACTION_INFO[clash.action].title}.`)
  const { data, error } = await supabase
    .from('voice_phrases')
    .insert({ user_id: userId, action, phrase, kind: 'custom' })
    .select('id, action, phrase, kind')
    .single()
  if (error) throw error
  return data as PhraseRow
}

export async function removePhraseRow(id: string): Promise<void> {
  const { error } = await supabase.from('voice_phrases').delete().eq('id', id)
  if (error) throw error
}

/** Switch a built-in phrase off (adds a 'disabled_default' row) or back on (removes it). */
export async function setDefaultEnabled(userId: string, rows: PhraseRow[], phrase: CommandPhrase, enabled: boolean): Promise<void> {
  const matching = rows.filter(
    (r) => r.kind === 'disabled_default' && r.action === phrase.action && r.phrase.toLowerCase() === phrase.phrase.toLowerCase(),
  )
  if (enabled) {
    for (const row of matching) await removePhraseRow(row.id)
  } else if (matching.length === 0) {
    const { error } = await supabase
      .from('voice_phrases')
      .insert({ user_id: userId, action: phrase.action, phrase: phrase.phrase, kind: 'disabled_default' })
    if (error) throw error
  }
}
