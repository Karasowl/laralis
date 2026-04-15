/**
 * Shared time-bucketing helpers for analytics endpoints.
 *
 * The dashboard date filter can be as narrow as a single day or as wide as
 * "all time". Hardcoding monthly buckets makes the resulting chart look
 * broken when the user picks a short range ("Este mes" => 1 point => flat
 * line). These helpers pick a sensible bucket size based on the range
 * width and emit a series of {start, end, label, key} tuples that the
 * caller can use to aggregate data without caring about granularity.
 *
 * - Range <= 45 days  -> daily buckets   ("15 abr")
 * - Range <= 365 days -> weekly buckets  ("Sem 16 - 13 abr")
 * - Range >  365 days -> monthly buckets ("abr 2026")
 *
 * Labels are formatted with the Spanish (es-MX) locale to match the rest
 * of the dashboard UI.
 */

export type Granularity = 'day' | 'week' | 'month'

export interface TimeBucket {
  /** ISO date (YYYY-MM-DD) of the first day in the bucket, inclusive. */
  start: string
  /** ISO date (YYYY-MM-DD) of the last day in the bucket, inclusive. */
  end: string
  /** Human-readable label intended for chart x-axis ticks. */
  label: string
  /** Stable key for Map lookups; matches `start`. */
  key: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function toIsoDate(d: Date): string {
  // Use local components so we don't drift days due to timezone offset.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeekMonday(d: Date): Date {
  // ISO week starts on Monday. JS getDay() returns 0=Sun..6=Sat.
  const day = d.getDay()
  const diff = (day + 6) % 7 // shift so Monday=0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
  return monday
}

function isoWeekNumber(d: Date): number {
  // Standard ISO 8601 week number.
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * DAY_MS))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Decide which bucket size to use for the given inclusive range.
 */
export function chooseGranularity(rangeStart: Date, rangeEnd: Date): Granularity {
  const days =
    Math.round((startOfDay(rangeEnd).getTime() - startOfDay(rangeStart).getTime()) / DAY_MS) + 1
  if (days <= 45) return 'day'
  if (days <= 365) return 'week'
  return 'month'
}

/**
 * Build the ordered list of buckets covering [rangeStart, rangeEnd] for the
 * given granularity. The first/last bucket are clipped to the range bounds
 * (e.g. monthly bucketing of an "Este mes" range still returns one bucket
 * with start/end matching the requested range, not the full calendar month).
 */
export function buildBuckets(
  rangeStart: Date,
  rangeEnd: Date,
  granularity: Granularity
): TimeBucket[] {
  const buckets: TimeBucket[] = []
  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)

  if (granularity === 'day') {
    const cursor = new Date(start)
    while (cursor <= end) {
      const iso = toIsoDate(cursor)
      buckets.push({
        start: iso,
        end: iso,
        key: iso,
        label: capitalize(
          cursor.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
        ),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return buckets
  }

  if (granularity === 'week') {
    let cursor = startOfWeekMonday(start)
    while (cursor <= end) {
      const weekStart = cursor < start ? new Date(start) : new Date(cursor)
      const weekEnd = new Date(cursor)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const clippedEnd = weekEnd > end ? new Date(end) : weekEnd
      const wn = isoWeekNumber(cursor)
      const labelDate = capitalize(
        weekStart.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
      )
      buckets.push({
        start: toIsoDate(weekStart),
        end: toIsoDate(clippedEnd),
        key: toIsoDate(weekStart),
        label: `Sem ${wn} · ${labelDate}`,
      })
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + 7)
    }
    return buckets
  }

  // Monthly bucketing.
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const lastBucketStart = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= lastBucketStart) {
    const monthStart = cursor < start ? new Date(start) : new Date(cursor)
    const monthEndCalendar = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const monthEnd = monthEndCalendar > end ? new Date(end) : monthEndCalendar
    buckets.push({
      start: toIsoDate(monthStart),
      end: toIsoDate(monthEnd),
      key: toIsoDate(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      label: capitalize(
        cursor.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
      ),
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return buckets
}

/**
 * Returns the bucket key for a given date according to the buckets array.
 * Linear scan; fine for the small bucket counts we deal with (<= ~365).
 */
export function findBucketKey(buckets: TimeBucket[], isoDate: string): string | null {
  for (const b of buckets) {
    if (isoDate >= b.start && isoDate <= b.end) return b.key
  }
  return null
}
