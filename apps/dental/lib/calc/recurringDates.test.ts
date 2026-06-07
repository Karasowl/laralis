import { describe, it, expect } from 'vitest'
import {
  addDays,
  addMonthsPgStyle,
  daysInMonth,
  advanceNextDue,
} from '@/convex/lib/recurringDates'

/**
 * Parity tests for the Convex port of process_recurring_expenses date math.
 * Expected values replicate Postgres `date + INTERVAL` semantics exactly
 * (month/year intervals clamp to end-of-month; LEAST anchors to recurrence_day).
 */

describe('daysInMonth', () => {
  it('handles 30/31-day months and February (leap + non-leap)', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29) // leap
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})

describe('addDays', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-06-01', 7)).toBe('2026-06-08')
    expect(addDays('2026-02-01', 30)).toBe('2026-03-03') // non-leap Feb
    expect(addDays('2024-02-01', 30)).toBe('2024-03-02') // leap Feb
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('addMonthsPgStyle (end-of-month clamp)', () => {
  it('clamps Jan 31 + 1 month to Feb 28/29', () => {
    expect(addMonthsPgStyle('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsPgStyle('2024-01-31', 1)).toBe('2024-02-29') // leap
  })
  it('keeps day when it fits and rolls the year', () => {
    expect(addMonthsPgStyle('2026-06-15', 1)).toBe('2026-07-15')
    expect(addMonthsPgStyle('2026-12-15', 1)).toBe('2027-01-15')
  })
  it('treats +12 months (yearly) with the same clamp', () => {
    expect(addMonthsPgStyle('2024-02-29', 12)).toBe('2025-02-28')
    expect(addMonthsPgStyle('2026-03-10', 12)).toBe('2027-03-10')
  })
})

describe('advanceNextDue', () => {
  it('weekly: +7 days', () => {
    expect(advanceNextDue('2026-06-01', 'weekly', null, '2026-06-01')).toBe('2026-06-08')
  })

  it('monthly mid-month stays on the same day', () => {
    expect(advanceNextDue('2026-06-15', 'monthly', 15, '2026-06-15')).toBe('2026-07-15')
  })

  it('monthly Jan 31 -> Feb 28 (non-leap), then Feb 28 -> Mar 28 (LEAST, no re-expand)', () => {
    expect(advanceNextDue('2026-01-31', 'monthly', 31, '2026-01-31')).toBe('2026-02-28')
    // Faithful to the SQL LEAST(): once clamped to 28 it does NOT recover to 31.
    expect(advanceNextDue('2026-02-28', 'monthly', 31, '2026-01-31')).toBe('2026-03-28')
  })

  it('monthly Jan 31 -> Feb 29 (leap)', () => {
    expect(advanceNextDue('2024-01-31', 'monthly', 31, '2024-01-31')).toBe('2024-02-29')
  })

  it('monthly recurrence_day NULL falls back to the template expense_date day', () => {
    expect(advanceNextDue('2026-03-10', 'monthly', null, '2026-01-10')).toBe('2026-04-10')
  })

  it('yearly normal keeps month/day, +1 year', () => {
    expect(advanceNextDue('2026-03-10', 'yearly', null, '2026-03-10')).toBe('2027-03-10')
  })

  it('yearly Feb 29 -> Feb 28 (PG end-of-month clamp)', () => {
    expect(advanceNextDue('2024-02-29', 'yearly', null, '2024-02-29')).toBe('2025-02-28')
  })

  it('null/unknown interval defaults to plain monthly (+1 month, clamped)', () => {
    expect(advanceNextDue('2026-06-15', null, null, '2026-06-15')).toBe('2026-07-15')
    expect(advanceNextDue('2026-01-31', 'daily', null, '2026-01-31')).toBe('2026-02-28')
  })
})
