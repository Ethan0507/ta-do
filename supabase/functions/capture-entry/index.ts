// iOS Shortcuts capture endpoint.
// Each user has their own capture token, sent as the x-capture-token header;
// only its SHA-256 hash is stored (profiles.capture_token_hash, see
// 0007_hash_capture_token.sql), so the same Shortcut can be shared and
// re-configured per user without exposing which account it writes to, and a
// leaked profiles table doesn't hand out usable tokens.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the Supabase runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// Labels arrive either as a JSON array (a Shortcuts dictionary field of type
// Array) or as one Text value, which is how Shortcuts serializes a
// multi-select "Choose from List" result: items joined by newlines. Commas are
// accepted too so a label list can be typed by hand.
function parseLabelNames(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const names = parts
    .filter((part): part is string => typeof part === 'string')
    .flatMap((part) => part.split(/[\n,]/))
    .map((name) => name.trim())
    .filter(Boolean)
  return [...new Set(names.map((name) => name.toLowerCase()))]
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const token = req.headers.get('x-capture-token')
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('capture_token_hash', await sha256Hex(token))
    .single()

  if (profileError || !profile) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Base categories (user_id null) plus this user's custom labels — the same
  // set the app's CategoryPicker offers. Filtered by hand since the
  // service-role client bypasses RLS.
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .or(`user_id.is.null,user_id.eq.${profile.id}`)
    .order('name')

  if (categoriesError) {
    return json({ error: categoriesError.message }, 500)
  }

  // GET lists the labels so a Shortcut can offer them in "Choose from List".
  if (req.method === 'GET') {
    return json({ labels: categories.map((category) => category.name) })
  }

  const body = await req.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return json({ error: 'Missing content' }, 400)
  }

  const labelNames = parseLabelNames(body?.labels ?? body?.label)
  const matched = categories.filter((category) => labelNames.includes(category.name.toLowerCase()))
  const unmatched = labelNames.filter((name) => !matched.some((category) => category.name.toLowerCase() === name))

  const type = body?.type === 'goal' || body?.type === 'task' ? body.type : 'thought'

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: profile.id,
      type,
      content,
      task_status: type === 'task' ? 'open' : null,
      goal_status: type === 'goal' ? 'ongoing' : null,
    })
    .select()
    .single()

  if (error) {
    return json({ error: error.message }, 500)
  }

  if (matched.length > 0) {
    const { error: labelError } = await supabase
      .from('entry_categories')
      .insert(matched.map((category) => ({ entry_id: data.id, category_id: category.id })))
    // The entry itself is saved; a labeling failure shouldn't make the
    // Shortcut report the whole capture as lost.
    if (labelError) {
      return json({ entry: data, labels: [], labelError: labelError.message })
    }
  }

  // Unknown label names are skipped rather than created, so a misheard or
  // mistyped label doesn't quietly add a new custom label.
  return json({ entry: data, labels: matched.map((category) => category.name), unmatchedLabels: unmatched })
})
