import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { GlassBackdrop } from '../components/GlassBackdrop'
import { Logomark } from '../components/Logomark'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSendLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  async function handleGoogleSignIn() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-bg)] px-5">
      <GlassBackdrop />

      <div className="relative w-full max-w-sm rounded-[28px] border border-[var(--glass-border)] bg-[var(--glass-fill-strong)] p-7 shadow-[var(--glass-shadow)] backdrop-blur-3xl">
        {!sent ? (
          <form onSubmit={handleSendLink} className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Logomark />
              <span className="text-[19px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                Ta-do
              </span>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)]">Enter your email and we'll send a sign-in link.</p>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">Email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border-[1.5px] border-[var(--color-primary)] bg-white/45 px-[18px] py-3 text-sm text-[var(--color-text)] outline-none"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-[var(--color-primary)] py-3 text-sm font-bold text-[var(--color-primary-on)] disabled:opacity-50"
            >
              {submitting ? 'Sending link…' : 'Send sign-in link'}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--glass-border)]" />
              <span className="text-xs text-[var(--color-text-faint)]">or</span>
              <div className="h-px flex-1 bg-[var(--glass-border)]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/50 py-3 text-sm font-semibold text-[var(--color-text)]"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11.2-4.1-13-9.6h-8.2C4.9 33.4 13.7 40 24 40c11 0 20-9 20-20 0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.3 6.6 29.4 5 24 5 15.9 5 8.9 9.6 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43c5.2 0 9.9-1.8 13.5-4.8l-6.2-5.2c-2 1.5-4.6 2.4-7.3 2.4-5.3 0-9.7-3.5-11.3-8.3l-6.4 4.9C9 38.3 16 43 24 43z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.2-4.4 5.5l6.2 5.2C40.7 35.9 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <Logomark size={32} />
            <div>
              <h1 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                Check your email
              </h1>
              <p className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">
                We sent a sign-in link to <span className="font-semibold text-[var(--color-text)]">{email}</span>. Open it
                on this device to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSent(false)
                setError(null)
              }}
              className="text-sm font-semibold text-[var(--color-primary)]"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
