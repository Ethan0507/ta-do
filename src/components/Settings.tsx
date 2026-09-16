import type { ThemePreference } from '../types'

interface SettingsProps {
  preference: ThemePreference
  onChange: (preference: ThemePreference) => void
  onClose: () => void
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

export function Settings({ preference, onChange, onClose }: SettingsProps) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md flex-col gap-4 rounded-t-[28px] border-t border-[var(--glass-border)] bg-[var(--glass-fill-strong)] px-5 pb-8 pt-3.5 shadow-[0_-12px_34px_oklch(30%_0.05_285_/_0.2)] backdrop-blur-3xl">
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

        <h2 className="text-lg font-bold text-[var(--color-text)]">Settings</h2>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Theme</span>
          <div className="flex gap-1 rounded-full bg-white/40 p-1">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
                  preference === option.value
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
