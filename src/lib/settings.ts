import { supabase } from './supabase'
import type { ThemePreference } from '../types'

export async function fetchThemePreference(userId: string): Promise<ThemePreference> {
  const { data, error } = await supabase.from('user_settings').select('theme_preference').eq('user_id', userId).single()
  if (error) throw error
  return data.theme_preference as ThemePreference
}

export async function updateThemePreference(userId: string, preference: ThemePreference): Promise<void> {
  const { error } = await supabase.from('user_settings').update({ theme_preference: preference }).eq('user_id', userId)
  if (error) throw error
}
