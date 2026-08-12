import { describe, expect, it } from 'vitest'
import { createTreatmentListPage } from './treatmentList'

function treatment(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `treatment-${index}`,
    patient_id: `patient-${index % 3}`,
    service_id: `service-${index % 2}`,
    treatment_date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    treatment_time: '10:00',
    status: 'completed',
    price_cents: 10000,
    amount_paid_cents: 10000,
    pending_balance_cents: 0,
    variable_cost_cents: 1000,
    fixed_cost_per_minute_cents: 100,
    duration_minutes: 30,
    ...overrides,
  }
}

describe('createTreatmentListPage', () => {
  it('returns one bounded page while keeping summaries over the full result', () => {
    const rows = Array.from({ length: 120 }, (_, index) => treatment(index + 1))
    const result = createTreatmentListPage({
      rows,
      filters: { today: '2026-08-12' },
      page: 1,
      pageSize: 50,
    })

    expect(result.data).toHaveLength(50)
    expect(result.pagination).toMatchObject({ page: 1, pageSize: 50, total: 120, pageCount: 3 })
    expect(result.filteredSummary.totalTreatments).toBe(120)
    expect(result.filteredSummary.totalRevenue).toBe(1_200_000)
    expect(result.overallSummary.totalTreatments).toBe(120)
  })

  it('applies combined filters before pagination and summary calculation', () => {
    const rows = [
      treatment(1, {
        patient_id: 'patient-match',
        service_id: 'service-match',
        treatment_date: '2026-08-20',
        status: 'scheduled',
        price_cents: 25000,
        amount_paid_cents: 5000,
        pending_balance_cents: 20000,
        notes: 'orthodontic follow-up',
      }),
      treatment(2, { treatment_date: '2026-07-10', status: 'completed' }),
      treatment(3, { treatment_date: '2026-08-21', status: 'cancelled' }),
    ]
    const result = createTreatmentListPage({
      rows,
      filters: {
        today: '2026-08-12',
        dateFrom: '2026-08-01',
        statuses: ['pending'],
        serviceIds: ['service-match'],
        priceFrom: 20000,
        hasBalance: true,
        typeFilter: 'appointments',
        search: 'orthodontic',
      },
      page: 0,
      pageSize: 50,
    })

    expect(result.data.map((row) => row.id)).toEqual(['treatment-1'])
    expect(result.data[0].status).toBe('pending')
    expect(result.filteredSummary.totalTreatments).toBe(1)
    expect(result.filteredSummary.pendingBalanceCents).toBe(20000)
    expect(result.overallSummary.totalTreatments).toBe(2)
  })

  it('matches patient and service names supplied by the indexed relation lookup', () => {
    const rows = [
      treatment(1, { patient_id: 'patient-match' }),
      treatment(2, { service_id: 'service-match' }),
      treatment(3),
    ]
    const result = createTreatmentListPage({
      rows,
      filters: {
        today: '2026-08-12',
        search: 'lara',
        matchingPatientIds: ['patient-match'],
        matchingServiceIds: ['service-match'],
      },
      page: 0,
      pageSize: 50,
    })

    expect(result.data.map((row) => row.id).sort()).toEqual(['treatment-1', 'treatment-2'])
  })
})
