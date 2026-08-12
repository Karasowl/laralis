import { describe, expect, it } from 'vitest'
import { calculateKPIs, generateBusinessInsights, type PatientData, type TreatmentData } from './analytics'

const treatment = (overrides: Partial<TreatmentData> = {}): TreatmentData => ({
  id: 't-1',
  patient_id: 'p-1',
  service_id: 's-1',
  treatment_date: '2026-07-01',
  price_cents: 10000,
  variable_cost_cents: 2000,
  fixed_per_minute_cents: 100,
  minutes: 30,
  margin_pct: 999,
  status: 'completed',
  ...overrides,
})

const patient = (id: string): PatientData => ({ id, first_name: '', last_name: '', created_at: '2026-07-01' })

describe('business analytics contracts', () => {
  it('uses actual cost margin and working days for KPIs', () => {
    const result = calculateKPIs([treatment()], [patient('p-1')], {
      workingDaysInPeriod: 20,
      totalPatients: 1,
    })

    expect(result.avgMargin).toBe(50)
    expect(result.avgPatientsPerDay).toBe(0.05)
    expect(result.avgNewPatientsPerDay).toBe(0.05)
  })

  it('keeps new-patient metrics even when there are no treatments', () => {
    const result = calculateKPIs([], [patient('p-1'), patient('p-2')], {
      workingDaysInPeriod: 20,
      totalPatients: 2,
    })
    expect(result.treatmentCount).toBe(0)
    expect(result.avgNewPatientsPerDay).toBe(0.1)
  })

  it('does not publish forecasts with fewer than three months', () => {
    const insights = generateBusinessInsights([treatment()], [patient('p-1')], {
      workingDaysInPeriod: 20,
      hoursPerDay: 6,
    })
    expect(insights.revenue_predictions.next_month.available).toBe(false)
    expect(insights.revenue_predictions.next_month.confidence).toBe(0)
  })

  it('uses configured capacity and period patient definitions', () => {
    const treatments = [
      treatment({ id: 't-1', patient_id: 'p-1', minutes: 60 }),
      treatment({ id: 't-2', patient_id: 'p-1', treatment_date: '2026-07-02', minutes: 60 }),
    ]
    const insights = generateBusinessInsights(treatments, [patient('p-1')], {
      workingDaysInPeriod: 2,
      hoursPerDay: 4,
    })
    expect(insights.operational_metrics.available_minutes_per_day).toBe(240)
    expect(insights.operational_metrics.average_treatment_minutes).toBe(60)
    expect(insights.operational_metrics.capacity_utilization).toBe(0.25)
    expect(insights.patient_insights.retention_rate).toBe(1)
    expect(insights.patient_insights.acquisition_rate).toBe(1)
  })
})
