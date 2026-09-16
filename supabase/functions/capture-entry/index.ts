// iOS Shortcuts capture endpoint.
// Each user has their own capture_token (profiles.capture_token, see
// 0005_capture_token.sql), sent as the x-capture-token header, so the same
// Shortcut can be shared and re-configured per user without exposing which
// account it writes to.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the Supabase runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
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
    .eq('capture_token', token)
    .single()

  if (profileError || !profile) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return new Response(JSON.stringify({ error: 'Missing content' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ entry: data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
