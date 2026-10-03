import { supabase } from './supabase'
import { deviceTimezone } from './settings'

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hasCaptureToken(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('capture_token_hash').eq('id', userId).single()
  if (error) throw error
  return data.capture_token_hash !== null
}

/** Generates a fresh token, stores only its hash, and returns the raw value — the only time it's ever visible. */
export async function regenerateCaptureToken(userId: string): Promise<string> {
  const token = randomToken()
  const hash = await sha256Hex(token)
  const { error } = await supabase.from('profiles').update({ capture_token_hash: hash }).eq('id', userId)
  if (error) throw error
  return token
}

/**
 * Keeps profiles.timezone in step with the device, so "today" means the same thing to the
 * server as to the app — unless the user picked a timezone manually in Account settings.
 */
export async function syncTimezone(userId: string): Promise<void> {
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('timezone_auto')
    .eq('user_id', userId)
    .single()
  if (settingsError) throw settingsError
  if (!settings.timezone_auto) return
  const timezone = deviceTimezone()
  if (!timezone) return
  const { error } = await supabase.from('profiles').update({ timezone }).eq('id', userId).neq('timezone', timezone)
  if (error) throw error
}

export async function fetchOnboardedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('onboarded_at').eq('id', userId).single()
  if (error) throw error
  return data.onboarded_at as string | null
}

export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId)
  if (error) throw error
}
