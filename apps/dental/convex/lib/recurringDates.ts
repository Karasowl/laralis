/**
 * Pure date math replicating the Postgres date arithmetic in
 * `process_recurring_expenses` (supabase/migrations/58_recurring_expenses.sql).
 *
 * This module has NO Convex/Next imports so it is unit-testable in Vitest and
 * bundleable by the Convex deployment. It lives under `convex/` because Convex
 * function modules can only import from within the `convex/` tree.
 *
 * All dates are 'YYYY-MM-DD' strings (UTC, zero-padded), matching how Supabase
 * `date` columns are stored in the Convex mirror.
 */

export type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly' | string | null | undefined

function parse(dateStr: string): { y: number; m: number; d: number } {
  const s = dateStr.slice(0, 10)
  const [y, m, d] = s.split('-').map((p) => parseInt(p, 10))
  return { y, m, d }
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function daysInMonth(year: number, month1: number): number {
  // month1 is 1-12. Date.UTC(year, month1, 0) -> last day of month1.
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

export function addDays(dateStr: string, n: number): string {
  const { y, m, d } = parse(dateStr)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/**
 * Postgres `date + INTERVAL 'N months'` semantics: advance the month field and
 * CLAMP the day to the last day of the target month (Jan 31 + 1mo -> Feb 28/29).
 *
 * `interval '1 year'` is stored internally as 12 months in Postgres and applies
 * the SAME end-of-month clamp (2024-02-29 + 1yr -> 2025-02-28), so yearly is
 * just `addMonthsPgStyle(date, 12)`.
 */
export function addMonthsPgStyle(dateStr: string, months: number): string {
  const { y, m, d } = parse(dateStr)
  const monthIndex0 = m - 1 + months
  const targetYear = y + Math.floor(monthIndex0 / 12)
  const targetMonth1 = (((monthIndex0 % 12) + 12) % 12) + 1
  const dim = daysInMonth(targetYear, targetMonth1)
  const day = Math.min(d, dim)
  return fmt(targetYear, targetMonth1, day)
}

function lexMin(a: string, b: string): string {
  return a <= b ? a : b
}

/**
 * Exact replica of the SQL CASE that advances next_recurrence_date by one period.
 *
 * @param nextRecurrenceDate current next_recurrence_date ('YYYY-MM-DD')
 * @param interval           recurrence_interval ('weekly'|'monthly'|'yearly'|null/other)
 * @param recurrenceDay      recurrence_day (1-31) or null
 * @param expenseDate        template expense_date ('YYYY-MM-DD'), for the recurrence_day NULL fallback
 */
export function advanceNextDue(
  nextRecurrenceDate: string,
  interval: RecurrenceInterval,
  recurrenceDay: number | null | undefined,
  expenseDate: string
): string {
  const next = nextRecurrenceDate.slice(0, 10)

  switch (interval) {
    case 'weekly':
      return addDays(next, 7)
    case 'yearly':
      // PG: + INTERVAL '1 year' == +12 months with end-of-month clamp.
      return addMonthsPgStyle(next, 12)
    case 'monthly': {
      // LEAST( next + 1 month (clamped),
      //        first-of-next-month + (COALESCE(recurrence_day, day(expense_date)) - 1) days )
      const a = addMonthsPgStyle(next, 1)
      const firstOfNextMonth = `${a.slice(0, 7)}-01`
      const anchorDay = recurrenceDay != null ? recurrenceDay : parse(expenseDate).d
      const b = addDays(firstOfNextMonth, anchorDay - 1)
      return lexMin(a, b)
    }
    default:
      // interval null/unknown -> default to plain monthly (+1 month, clamped).
      return addMonthsPgStyle(next, 1)
  }
}
