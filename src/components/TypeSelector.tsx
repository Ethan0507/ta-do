import { useState } from 'react'
import type { EntryType } from '../types'

interface TypeSelectorProps {
  value: EntryType
  onChange: (type: EntryType) => void
}

const OPTIONS: { type: EntryType; label: string; icon: JSX.Element }[] = [
  {
    type: 'thought',
    label: 'Thoughts',
    icon: (
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
    ),
  },
  {
    type: 'task',
    label: 'Tasks',
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M8.5 12.5l2.3 2.3L16 9.5" />
      </>
    ),
  },
  {
    type: 'goal',
    label: 'Goals',
    icon: (
      <>
        <path d="M6 21V4" />
        <path d="M6 5h12l-2.8 3.5L18 12H6" />
      </>
    ),
  },
]

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  const [open, setOpen] = useState(false)
  const current = OPTIONS.find((o) => o.type === value) ?? OPTIONS[0]

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-2.5 shadow-[var(--glass-shadow)] backdrop-blur-xl"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {current.icon}
        </svg>
        <span className="text-[13.5px] font-bold text-[var(--color-text)]">{current.label}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-2 w-44 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill-strong)] p-1.5 shadow-[var(--glass-shadow)] backdrop-blur-2xl">
            {OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => {
                  onChange(option.type)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${
                  option.type === value ? 'bg-white/50' : ''
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={option.type === value ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {option.icon}
                </svg>
                <span className={`flex-1 text-sm ${option.type === value ? 'font-bold' : 'font-semibold'} text-[var(--color-text)]`}>
                  {option.label}
                </span>
                {option.type === value && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
