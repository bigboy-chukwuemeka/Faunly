// A repeating reminder is stored as several upcoming reminders (one per day, week, ...).
// These helpers let the lists show it as ONE card instead.

// Keeps every reminder that is not part of a repeating series,
// and for each series keeps only the soonest reminder that is still pending.
// Done or dismissed reminders are left exactly as they are.
export function collapseSeries(reminders) {
  const soonestPending = {}
  for (const r of reminders) {
    if (r.series_id && r.status === 'pending') {
      const current = soonestPending[r.series_id]
      if (!current || new Date(r.due_at) < new Date(current.due_at)) {
        soonestPending[r.series_id] = r
      }
    }
  }
  return reminders.filter(
    (r) => !(r.series_id && r.status === 'pending') || soonestPending[r.series_id] === r
  )
}

const SINGULAR = { days: 'day', weeks: 'week', months: 'month', years: 'year' }
const BY_KIND = { daily: 'every day', weekly: 'every week', monthly: 'every month', yearly: 'every year' }

// "every day", "every week", "every 2 weeks"... or '' if the reminder does not repeat.
export function repeatPhrase(reminder) {
  if (!reminder || !reminder.repeat_kind || reminder.repeat_kind === 'never') return ''
  const every = Number(reminder.repeat_every)
  const unit = reminder.repeat_unit
  if (every >= 1 && SINGULAR[unit]) {
    return every === 1 ? `every ${SINGULAR[unit]}` : `every ${every} ${unit}`
  }
  return BY_KIND[reminder.repeat_kind] || 'repeats'
}
