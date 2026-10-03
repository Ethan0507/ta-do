// "Today" for the app, in the account's timezone (profiles.timezone) rather than the
// device's — so Home and the server-side repeat generator agree on when a day starts,
// even when a timezone was picked manually in Account settings.

let appTimezone: string | undefined

export function setAppTimezone(timezone: string): void {
  appTimezone = timezone
}

function datePartsIn(instant: Date, timezone: string | undefined) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Offset of `timezone` from UTC at `instant`, in ms. */
function offsetMs(instant: Date, timezone: string | undefined): number {
  const p = datePartsIn(instant, timezone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000
}

/** Today as YYYY-MM-DD in the account's timezone. */
export function todayDateString(): string {
  const p = datePartsIn(new Date(), appTimezone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Whole days from today to `date` (YYYY-MM-DD): 0 = today, 1 = tomorrow, negative = past. */
export function daysFromToday(date: string): number {
  const [y, m, d] = todayDateString().split('-').map(Number)
  const [y2, m2, d2] = date.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86400000)
}

/** Start and end of today in the account's timezone, as ISO instants. */
export function todayRange(): { startISO: string; endISO: string } {
  const [y, m, d] = todayDateString().split('-').map(Number)
  const midnightAt = (day: number) => {
    const guess = new Date(Date.UTC(y, m - 1, day))
    const first = new Date(guess.getTime() - offsetMs(guess, appTimezone))
    // Re-check once in case a DST change falls between the guess and the real midnight.
    return new Date(guess.getTime() - offsetMs(first, appTimezone))
  }
  return { startISO: midnightAt(d).toISOString(), endISO: midnightAt(d + 1).toISOString() }
}
