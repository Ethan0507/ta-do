import { useEffect, useRef, useState } from 'react'
import { supabaseUrl } from '../lib/supabase'
import { hasCaptureToken, regenerateCaptureToken, markOnboarded } from '../lib/profile'
import { findRecentEntryByContent } from '../lib/entries'

const TEST_PHRASE = 'I have a thought'
const POLL_MS = 3000

interface CaptureSetupProps {
  userId: string
  onClose: () => void
}

export function CaptureSetup({ userId, onClose }: CaptureSetupProps) {
  const [token, setToken] = useState<string | null>(null)
  const [tokenAlreadySet, setTokenAlreadySet] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'url' | 'token' | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [testFound, setTestFound] = useState(false)
  const openedAtRef = useRef(new Date().toISOString())

  useEffect(() => {
    hasCaptureToken(userId)
      .then(async (has) => {
        if (has) {
          setTokenAlreadySet(true)
        } else {
          setToken(await regenerateCaptureToken(userId))
        }
      })
      .catch((err) => setLoadError(err.message ?? 'Failed to load token'))
  }, [userId])

  useEffect(() => {
    if (testFound) return
    const interval = setInterval(async () => {
      const found = await findRecentEntryByContent(TEST_PHRASE, openedAtRef.current).catch(() => null)
      if (found) {
        setTestFound(true)
        markOnboarded(userId).catch(() => {})
      }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [testFound, userId])

  const functionUrl = `${supabaseUrl}/functions/v1/capture-entry`
  const shortcutUrl = `${window.location.origin}/${encodeURIComponent('Brain Dump.shortcut')}`

  async function copy(value: string, which: 'url' | 'token') {
    await navigator.clipboard.writeText(value)
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  async function handleRegenerate() {
    if (tokenAlreadySet && !confirm('Regenerating will break any Shortcut still using the old token. Continue?')) return
    setRegenerating(true)
    const next = await regenerateCaptureToken(userId)
    setToken(next)
    setTokenAlreadySet(false)
    setRegenerating(false)
  }

  function handleClose() {
    onClose()
  }

  async function handleMarkComplete() {
    await markOnboarded(userId)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={handleClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[85dvh] max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
        <div className="relative flex items-center justify-center">
          <div className="h-1 w-9 rounded-full bg-black/20" />
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-0 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Set up voice capture</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            Say "Hey Siri, brain dump" anywhere and it lands in your Today list. Three steps to set it up.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/45 p-3.5">
          <div className="flex items-start gap-2.5">
            <StepBadge n={1} />
            <p className="text-[13px] text-[var(--color-text)]">
              On your iPhone, open this link and tap <strong>Add Shortcut</strong>:
            </p>
          </div>
          <a
            href={shortcutUrl}
            className="ml-[30px] break-all rounded-xl border border-[var(--color-primary)] bg-white/60 px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-primary)]"
          >
            {shortcutUrl}
          </a>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/45 p-3.5">
          <div className="flex items-start gap-2.5">
            <StepBadge n={2} />
            <p className="text-[13px] text-[var(--color-text)]">
              Open the imported Shortcut, find the <code className="rounded bg-black/10 px-1">x-capture-token</code>{' '}
              header, and replace the placeholder with your token below:
            </p>
          </div>
          {token ? (
            <>
              <button
                type="button"
                onClick={() => copy(token, 'token')}
                className="ml-[30px] break-all rounded-xl border border-[var(--glass-border)] bg-white/60 px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text)]"
              >
                {token}
              </button>
              <span className="ml-[30px] text-xs text-[var(--color-text-muted)]">
                Copy this now — for your security, it won't be shown again after you leave this screen.
              </span>
              {copied === 'token' && <span className="ml-[30px] text-xs text-[var(--color-success)]">Copied</span>}
            </>
          ) : tokenAlreadySet ? (
            <span className="ml-[30px] text-[13px] text-[var(--color-text-muted)]">
              Already set — if you've lost it, use "Regenerate token" below (this'll require updating your Shortcut).
            </span>
          ) : (
            <span className="ml-[30px] text-[13px] text-[var(--color-text-muted)]">{loadError ? 'Unable to load' : 'Loading…'}</span>
          )}
          {loadError && <span className="ml-[30px] text-xs text-red-600">{loadError}</span>}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/45 p-3.5">
          <div className="flex items-start gap-2.5">
            <StepBadge n={3} />
            <p className="text-[13px] text-[var(--color-text)]">
              Try: <strong>&ldquo;Hey Siri, Brain dump, {TEST_PHRASE}&rdquo;</strong> to test your capture.
            </p>
          </div>
          <div
            className={`ml-[30px] flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${
              testFound ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-white/60 text-[var(--color-text-muted)]'
            }`}
          >
            {testFound ? (
              <>✓ Got it — your Shortcut is working!</>
            ) : (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Waiting for your test thought…
              </>
            )}
          </div>
        </div>

        <details className="text-[13px] text-[var(--color-text-muted)]">
          <summary className="cursor-pointer font-semibold">Building it by hand instead?</summary>
          <div className="mt-2 flex flex-col gap-2">
            <p>
              Add a <strong>Dictate Text</strong> action, then a <strong>Get Contents of URL</strong> action: Method{' '}
              <strong>POST</strong>, URL below, a JSON body with key <code className="rounded bg-black/10 px-1">content</code>{' '}
              set to the dictated text, and the token header from step 2 above.
            </p>
            <button
              type="button"
              onClick={() => copy(functionUrl, 'url')}
              className="break-all rounded-xl border border-[var(--glass-border)] bg-white/45 px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text)]"
            >
              {functionUrl}
            </button>
            {copied === 'url' && <span className="text-xs text-[var(--color-success)]">Copied</span>}
          </div>
        </details>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="w-fit rounded-full border border-[var(--glass-border)] bg-white/40 px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] disabled:opacity-50"
        >
          {regenerating ? 'Regenerating…' : 'Regenerate token'}
        </button>

        <button
          type="button"
          onClick={handleMarkComplete}
          className="w-full rounded-full bg-[var(--color-primary)] py-2.5 text-sm font-bold text-[var(--color-primary-on)]"
        >
          {testFound ? 'Done' : 'Mark onboarding complete'}
        </button>
      </div>
    </>
  )
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[11px] font-bold text-[var(--color-primary-on)]">
      {n}
    </span>
  )
}
