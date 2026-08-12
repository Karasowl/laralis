import { describe, expect, it } from 'vitest'
import {
  getDefaultRecurrenceDay,
  RECURRENCE_INTERVAL_VALUES,
} from './expense-recurrence'

describe('recurring expense controls', () => {
  it('never exposes an empty Radix Select item value', () => {
    expect(RECURRENCE_INTERVAL_VALUES).toEqual(['weekly', 'monthly', 'yearly'])
    expect(RECURRENCE_INTERVAL_VALUES.every(Boolean)).toBe(true)
  })

  it('uses the expense day for monthly and yearly recurrence', () => {
    expect(getDefaultRecurrenceDay('2026-08-19', 'monthly')).toBe(19)
    expect(getDefaultRecurrenceDay('2026-08-19', 'yearly')).toBe(19)
  })

  it('keeps weekly recurrence inside the supported 1 to 7 range', () => {
    expect(getDefaultRecurrenceDay('2026-08-19', 'weekly')).toBe(7)
    expect(getDefaultRecurrenceDay('', 'weekly')).toBe(1)
  })
})
