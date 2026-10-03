import { useEffect, useMemo, useState } from 'react'
import type { ThemePreference } from '../types'
import { deviceTimezone, fetchTimezoneSetting, updateTimezoneSetting, type TimezoneSetting } from '../lib/settings'

interface AccountSettingsProps {
  userId: string
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
  /** Called after the timezone changes — "today" may now be a different date. */
  onTimezoneChanged: () => void
  onClose: () => void
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

export function AccountSettings({ userId, themePreference, onThemeChange, onTimezoneChanged, onClose }: AccountSettingsProps) {
  const [timezone, setTimezone] = useState<TimezoneSetting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), [])

  useEffect(() => {
    fetchTimezoneSetting(userId)
      .then(setTimezone)
      .catch((err) => setError(err.message ?? 'Failed to load settings'))
  }, [userId])

  async function saveTimezone(next: TimezoneSetting) {
    const previous = timezone
    setTimezone(next.auto ? { auto: true, timezone: deviceTimezone() } : next)
    try {
      await updateTimezoneSetting(userId, next)
      onTimezoneChanged()
    } catch (err) {
      setTimezone(previous)
      setError(err instanceof Error ? err.message : 'Failed to save timezone')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[85dvh] max-w-md flex-col gap-5 overflow-y-auto rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
        <div className="relative flex items-center justify-center">
          <div className="h-1 w-9 rounded-full bg-black/20" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/50"
            aria-label="Close"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <span className="text-[17px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          Account settings
        </span>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Theme</span>
          <div className="flex gap-1.5">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onThemeChange(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                  themePreference === option.value
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]'
                    : 'bg-white/45 text-[var(--color-text)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--color-text-faint)]">Auto follows your device's light/dark setting.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Timezone</span>
          {timezone && (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--color-text)]">Use device timezone</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={timezone.auto}
                  onClick={() => saveTimezone({ auto: !timezone.auto, timezone: timezone.timezone })}
                  className={`h-[18px] w-8 shrink-0 rounded-full p-0.5 transition-colors ${timezone.auto ? 'bg-[var(--color-primary)]' : 'bg-black/20'}`}
                >
                  <div className={`h-[14px] w-[14px] rounded-full bg-white transition-transform ${timezone.auto ? 'translate-x-[14px]' : ''}`} />
                </button>
              </label>
              {timezone.auto ? (
                <span className="text-[13px] text-[var(--color-text-muted)]">{timezone.timezone}</span>
              ) : (
                <select
                  value={timezone.timezone}
                  onChange={(e) => saveTimezone({ auto: false, timezone: e.target.value })}
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  {!timezones.includes(timezone.timezone) && <option value={timezone.timezone}>{timezone.timezone}</option>}
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-[11px] text-[var(--color-text-faint)]">
                Decides when your day starts — repeating tasks are created at midnight in this timezone.
              </span>
            </>
          )}
          {error && <span className="text-xs font-semibold text-[var(--color-tertiary)]">{error}</span>}
        </div>
      </div>
    </>
  )
}
