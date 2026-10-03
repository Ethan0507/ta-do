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

export interface TimezoneSetting {
  auto: boolean
  timezone: string
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export async function fetchTimezoneSetting(userId: string): Promise<TimezoneSetting> {
  const [settings, profile] = await Promise.all([
    supabase.from('user_settings').select('timezone_auto').eq('user_id', userId).single(),
    supabase.from('profiles').select('timezone').eq('id', userId).single(),
  ])
  if (settings.error) throw settings.error
  if (profile.error) throw profile.error
  return { auto: settings.data.timezone_auto as boolean, timezone: profile.data.timezone as string }
}

/** auto = follow the device (synced on every app load); otherwise `timezone` sticks until changed here. */
export async function updateTimezoneSetting(userId: string, setting: TimezoneSetting): Promise<void> {
  const { error } = await supabase.from('user_settings').update({ timezone_auto: setting.auto }).eq('user_id', userId)
  if (error) throw error
  const timezone = setting.auto ? deviceTimezone() : setting.timezone
  const { error: profileError } = await supabase.from('profiles').update({ timezone }).eq('id', userId)
  if (profileError) throw profileError
}
