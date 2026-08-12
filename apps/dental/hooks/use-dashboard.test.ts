import { describe, expect, it } from 'vitest'
import { DashboardAggregator } from './use-dashboard'

describe('DashboardAggregator patient metrics', () => {
  it('keeps attended and active counts returned by the API', () => {
    const metrics = DashboardAggregator.aggregateMetrics([
      {},
      {},
      { patients: { total: 191, new: 3, attended: 27, active: 44 } },
      {},
      {},
      {},
    ])

    expect(metrics.patients).toEqual({
      total: 191,
      new: 3,
      attended: 27,
      active: 44,
      change: null,
    })
  })

  it('accepts the flat API response shape for attended patients', () => {
    const metrics = DashboardAggregator.aggregateMetrics([{}, {}, { attended: 8 }, {}, {}, {}])
    expect(metrics.patients.attended).toBe(8)
  })
})
