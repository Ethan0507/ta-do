import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setStage('code')
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setSubmitting(false)
    if (error) setError(error.message)
  }

  async function handleResend() {
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setSubmitting(false)
    if (error) setError(error.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      {stage === 'email' ? (
        <form onSubmit={handleSendCode} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Ta-do</h1>
          <p className="text-sm text-slate-500">Enter your email and we'll send you a one-time code.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Sending code…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
          <h1 className="text-xl font-semibold text-slate-900">Ta-do</h1>
          <p className="text-sm text-slate-500">
            We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700">Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em]"
              maxLength={6}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || code.length < 6}
            className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : 'Verify and continue'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStage('email')
                setCode('')
                setError(null)
              }}
              className="text-slate-500 underline"
            >
              Change email
            </button>
            <button type="button" onClick={handleResend} disabled={submitting} className="text-slate-500 underline disabled:opacity-50">
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
