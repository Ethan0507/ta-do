import { useEffect, useState } from 'react'
import { supabaseUrl } from '../lib/supabase'
import { fetchCaptureToken, regenerateCaptureToken } from '../lib/profile'

interface CaptureSetupProps {
  userId: string
  onClose: () => void
}

export function CaptureSetup({ userId, onClose }: CaptureSetupProps) {
  const [token, setToken] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'url' | 'token' | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    fetchCaptureToken(userId)
      .then(setToken)
      .catch((err) => setLoadError(err.message ?? 'Failed to load token'))
  }, [userId])

  const functionUrl = `${supabaseUrl}/functions/v1/capture-entry`

  async function copy(value: string, which: 'url' | 'token') {
    await navigator.clipboard.writeText(value)
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  async function handleRegenerate() {
    if (!confirm('Regenerating will break any Shortcut still using the old token. Continue?')) return
    setRegenerating(true)
    const next = await regenerateCaptureToken(userId)
    setToken(next)
    setRegenerating(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[85vh] max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
        <div className="relative flex items-center justify-center">
          <div className="h-1 w-9 rounded-full bg-black/20" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Shortcuts capture</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            Point your iOS Shortcut's "Get Contents of URL" action at this URL, with your token in the{' '}
            <code className="rounded bg-black/10 px-1">x-capture-token</code> header. If you share the Shortcut with
            someone else, they'll swap in their own token from this screen — entries always land in the account the
            token belongs to.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Function URL</span>
          <button
            type="button"
            onClick={() => copy(functionUrl, 'url')}
            className="break-all rounded-xl border border-[var(--glass-border)] bg-white/45 px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text)]"
          >
            {functionUrl}
          </button>
          {copied === 'url' && <span className="text-xs text-[var(--color-success)]">Copied</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Your capture token</span>
          <button
            type="button"
            onClick={() => token && copy(token, 'token')}
            disabled={!token}
            className="break-all rounded-xl border border-[var(--glass-border)] bg-white/45 px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text)]"
          >
            {token ?? (loadError ? 'Unable to load' : 'Loading…')}
          </button>
          {copied === 'token' && <span className="text-xs text-[var(--color-success)]">Copied</span>}
          {loadError && <span className="text-xs text-red-600">{loadError}</span>}
        </div>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating || !token}
          className="w-fit rounded-full border border-[var(--glass-border)] bg-white/40 px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] disabled:opacity-50"
        >
          {regenerating ? 'Regenerating…' : 'Regenerate token'}
        </button>
      </div>
    </>
  )
}
