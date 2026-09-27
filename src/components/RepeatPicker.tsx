import type { RecurrenceFreq, RecurrenceRule } from '../types'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const FREQ_OPTIONS: { value: RecurrenceFreq | 'none'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
]

interface RepeatPickerProps {
  value: RecurrenceRule | null
  dueDate: string
  onChange: (rule: RecurrenceRule | null) => void
}

function referenceDate(dueDate: string): Date {
  return dueDate ? new Date(`${dueDate}T00:00:00`) : new Date()
}

function WeekdayChips({ isSelected, onToggle }: { isSelected: (day: number) => boolean; onToggle: (day: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAY_LABELS.map((label, day) => (
        <button
          key={day}
          type="button"
          onClick={() => onToggle(day)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
            isSelected(day) ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]' : 'bg-white/45 text-[var(--color-text)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function RepeatPicker({ value, dueDate, onChange }: RepeatPickerProps) {
  function selectFreq(next: RecurrenceFreq | 'none') {
    if (next === value?.freq) return
    if (next === 'none') {
      onChange(null)
    } else if (next === 'daily') {
      onChange({ freq: 'daily' })
    } else if (next === 'weekly') {
      onChange({ freq: 'weekly', weekday: referenceDate(dueDate).getDay() })
    } else if (next === 'monthly') {
      onChange({ freq: 'monthly', day_of_month: referenceDate(dueDate).getDate() })
    } else {
      onChange({ freq: 'custom', weekdays: [referenceDate(dueDate).getDay()], times: ['09:00'] })
    }
  }

  function selectWeeklyDay(day: number) {
    if (value?.freq !== 'weekly') return
    onChange({ ...value, weekday: day })
  }

  function toggleSingleTime() {
    if (value?.freq !== 'daily' && value?.freq !== 'weekly') return
    if (value.time) {
      onChange(value.freq === 'daily' ? { freq: 'daily' } : { freq: 'weekly', weekday: value.weekday })
    } else {
      onChange({ ...value, time: '09:00' })
    }
  }

  function updateSingleTime(time: string) {
    if (value?.freq !== 'daily' && value?.freq !== 'weekly') return
    onChange({ ...value, time })
  }

  function toggleCustomWeekday(day: number) {
    if (value?.freq !== 'custom') return
    const next = value.weekdays.includes(day) ? value.weekdays.filter((d) => d !== day) : [...value.weekdays, day].sort()
    onChange({ ...value, weekdays: next })
  }

  function updateCustomTime(index: number, time: string) {
    if (value?.freq !== 'custom') return
    const times = [...value.times]
    times[index] = time
    onChange({ ...value, times })
  }

  function addCustomTime() {
    if (value?.freq !== 'custom') return
    onChange({ ...value, times: [...value.times, '09:00'] })
  }

  function removeCustomTime(index: number) {
    if (value?.freq !== 'custom') return
    onChange({ ...value, times: value.times.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold text-[var(--color-text-muted)]">Repeat</span>
      <div className="flex flex-wrap gap-1.5">
        {FREQ_OPTIONS.map((option) => {
          const active = option.value === 'none' ? value === null : value?.freq === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectFreq(option.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                active ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]' : 'bg-white/45 text-[var(--color-text)]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {value?.freq === 'weekly' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Day of week</span>
          <WeekdayChips isSelected={(day) => value.weekday === day} onToggle={selectWeeklyDay} />
        </div>
      )}

      {(value?.freq === 'daily' || value?.freq === 'weekly') && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSingleTime}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
              value.time ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]' : 'bg-white/45 text-[var(--color-text)]'
            }`}
          >
            {value.time ? 'Time set' : 'Add time'}
          </button>
          {value.time && (
            <input
              type="time"
              value={value.time}
              onChange={(e) => updateSingleTime(e.target.value)}
              className="rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-1.5 text-sm text-[var(--color-text)]"
            />
          )}
        </div>
      )}

      {value?.freq === 'custom' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-white/30 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Days of week</span>
            <WeekdayChips isSelected={(day) => value.weekdays.includes(day)} onToggle={toggleCustomWeekday} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Times of day</span>
            <div className="flex flex-col gap-1.5">
              {value.times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateCustomTime(index, e.target.value)}
                    className="rounded-xl border border-[var(--glass-border)] bg-white/45 px-3 py-1.5 text-sm text-[var(--color-text)]"
                  />
                  {value.times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCustomTime(index)}
                      className="text-xs font-bold text-[var(--color-text-faint)]"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addCustomTime} className="w-fit text-xs font-bold text-[var(--color-primary)]">
                + Add time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
