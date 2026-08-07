// ---------------------------------------------------------------------------
// Relative / exact timestamp formatting.
//
// Hand-rolled rather than pulling in date-fns or Intl.RelativeTimeFormat:
// this app has no date library (see package.json) and the only consumer is
// the dashboard activity feed, which needs five coarse buckets. Adding a
// dependency for that isn't worth the bundle cost on a field-facing app.
//
// Both formatters are exported because the feed shows BOTH — relative time
// for scanning, exact time so office/field users can tell precisely when
// something happened rather than "about 2 hours ago".
// ---------------------------------------------------------------------------

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`
}

// e.g. 'just now', '12 minutes ago', '3 hours ago', '2 days ago'.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  // Negative deltas happen with client/server clock skew — a timestamp a few
  // seconds in the future should read 'just now', not '-1 minutes ago'.
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000))

  if (seconds < MINUTE) return 'just now'
  if (seconds < HOUR) return plural(Math.floor(seconds / MINUTE), 'minute')
  if (seconds < DAY) return plural(Math.floor(seconds / HOUR), 'hour')
  if (seconds < WEEK) return plural(Math.floor(seconds / DAY), 'day')
  return plural(Math.floor(seconds / WEEK), 'week')
}

// e.g. 'Aug 7, 2026, 3:45 PM'. Rendered in the viewer's local timezone,
// same as every other timestamp in this app (NotesPage, ReportsPage,
// ChecklistItem all use toLocaleString()).
export function formatExactTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
