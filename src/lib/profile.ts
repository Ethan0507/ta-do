import { supabase } from './supabase'

export async function fetchCaptureToken(userId: string): Promise<string> {
  const { data, error } = await supabase.from('profiles').select('capture_token').eq('id', userId).single()
  if (error) throw error
  return data.capture_token as string
}

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function regenerateCaptureToken(userId: string): Promise<string> {
  const token = randomToken()
  const { error } = await supabase.from('profiles').update({ capture_token: token }).eq('id', userId)
  if (error) throw error
  return token
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
