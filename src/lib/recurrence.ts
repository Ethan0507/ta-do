import type { RecurrenceRule } from '../types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Short description of a repeat rule, e.g. "Weekdays · 07:00" — same wording as the iOS app. */
export function describeRule(rule: RecurrenceRule): string {
  let base: string
  if (rule.freq === 'daily') base = 'Daily'
  else if (rule.freq === 'weekly') base = `Every ${DAYS[rule.weekday]}`
  else if (rule.freq === 'monthly') base = `Monthly on day ${rule.day_of_month}`
  else {
    const set = rule.weekdays.join(',')
    base = set === '1,2,3,4,5' ? 'Weekdays' : set === '0,6' ? 'Weekends' : rule.weekdays.map((d) => DAYS[d]).join(', ')
  }
  return rule.time ? `${base} · ${rule.time}` : base
}
