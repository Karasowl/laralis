import { describe, expect, it } from 'vitest'
import { countUniqueCompletedPatientsInRange } from './patient-metrics'

describe('countUniqueCompletedPatientsInRange', () => {
  it('counts each attended patient once in the selected period', () => {
    const treatments = [
      { patient_id: 'patient-1', treatment_date: '2026-07-03', status: 'completed' },
      { patient_id: 'patient-1', treatment_date: '2026-07-20', status: 'completed' },
      { patient_id: 'patient-2', treatment_date: '2026-07-31', status: 'completed' },
      { patient_id: 'patient-3', treatment_date: '2026-08-01', status: 'completed' },
      { patient_id: 'patient-4', treatment_date: '2026-07-10', status: 'pending' },
    ]

    expect(countUniqueCompletedPatientsInRange(
      treatments,
      '2026-07-01',
      '2026-07-31'
    )).toBe(2)
  })
})
