import { describe, expect, it } from 'vitest'
import {
  calculatePercentageChange,
  calculateWeightedRoi,
  collectedRevenueCents,
  compareValues,
  getPreviousPeriodRange,
  normalizeCostCategory,
  prorateMonthlyAmountForRange,
} from './metrics'

describe('metric contracts', () => {
  it('compares against the previous value and preserves the sign', () => {
    expect(calculatePercentageChange(35, 9)).toBe(288.9)
    expect(calculatePercentageChange(9, 35)).toBe(-74.3)
    expect(compareValues(35, 9)).toEqual({ change: 288.9, trend: 'up' })
  })

  it('does not invent 100 percent when the reference is zero', () => {
    expect(calculatePercentageChange(35, 0)).toBeNull()
    expect(compareValues(35, 0)).toEqual({ change: null, trend: null })
    expect(calculatePercentageChange(0, 0)).toBe(0)
  })

  it('builds inclusive previous ranges without timezone shifts', () => {
    expect(getPreviousPeriodRange('2026-07-01', '2026-07-31')).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('prorates monthly amounts across month boundaries', () => {
    expect(prorateMonthlyAmountForRange(3100, '2026-01-16', '2026-01-31')).toBe(1600)
    expect(prorateMonthlyAmountForRange(2800, '2026-02-01', '2026-02-28')).toBe(2800)
    expect(prorateMonthlyAmountForRange(3100, '2026-01-31', '2026-02-01')).toBe(211)
  })

  it('uses aggregate revenue and cost for ROI', () => {
    expect(calculateWeightedRoi([
      { revenueCents: 200, costCents: 100 },
      { revenueCents: 1010, costCents: 1000 },
    ])).toBe(10)
    expect(calculateWeightedRoi([{ revenueCents: 100, costCents: 0 }])).toBeNull()
  })

  it('counts only cash collected from completed treatments', () => {
    expect(collectedRevenueCents({ status: 'completed', price_cents: 1000, amount_paid_cents: 400 })).toBe(400)
    expect(collectedRevenueCents({ status: 'completed', price_cents: 1000, is_paid: true })).toBe(1000)
    expect(collectedRevenueCents({ status: 'pending', price_cents: 1000, amount_paid_cents: 1000 })).toBe(0)
  })

  it('maps planned and actual cost labels to stable categories', () => {
    expect(normalizeCostCategory('Salario asistentes')).toBe('Nómina')
    expect(normalizeCostCategory('Electricidad')).toBe('Servicios')
    expect(normalizeCostCategory('Laboratorio dental')).toBe('Insumos')
  })
})
