import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'


import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import {
  generateBusinessInsights,
  calculateKPIs,
  TreatmentData,
  PatientData,
} from '@/lib/analytics'

const querySchema = z.object({
  clinicId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

const DEFAULT_MONTH_LOOKBACK = 6

function normaliseDateString(value: string | undefined, fallback: Date): string {
  if (!value) {
    return fallback.toISOString().split('T')[0]
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback.toISOString().split('T')[0]
  }

  return parsed.toISOString().split('T')[0]
}

export const GET = withPermission('financial_reports.view', async (request, context) => {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(searchParams)

    if (!parsed.success) {
      const message = parsed.error.errors.map(err => err.message).join(', ')
      return NextResponse.json({ error: 'Invalid query parameters', message }, { status: 400 })
    }

    const { from, to } = parsed.data
    const clinicId = context.clinicId

    const today = new Date()
    const defaultRangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const endDate = to ? new Date(to) : defaultRangeEnd
    if (Number.isNaN(endDate.getTime())) {
      endDate.setTime(defaultRangeEnd.getTime())
    }

    const startDate = from ? new Date(from) : new Date(endDate)
    if (Number.isNaN(startDate.getTime())) {
      startDate.setTime(endDate.getTime())
    }

    if (!from) {
      startDate.setMonth(startDate.getMonth() - DEFAULT_MONTH_LOOKBACK)
      startDate.setDate(1)
    }

    const startISO = normaliseDateString(startDate.toISOString(), startDate)
    const endISO = normaliseDateString(endDate.toISOString(), endDate)

    const [treatmentsResult, patientsResult] = await Promise.all([
      supabaseAdmin
        .from('treatments')
        .select(
          'id, patient_id, service_id, treatment_date, status, price_cents, variable_cost_cents, fixed_cost_per_minute_cents, margin_pct, minutes'
        )
        .eq('clinic_id', clinicId)
        .gte('treatment_date', startISO)
        .lte('treatment_date', endISO),
      supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name, created_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', startISO)
        .lte('created_at', endISO + 'T23:59:59.999Z'),
    ])

    if (treatmentsResult.error) {
      console.error('[reports/summary] Failed to fetch treatments', treatmentsResult.error)
      return NextResponse.json(
        { error: 'Failed to fetch treatments', message: treatmentsResult.error.message },
        { status: 500 }
      )
    }

    if (patientsResult.error) {
      console.error('[reports/summary] Failed to fetch patients', patientsResult.error)
      return NextResponse.json(
        { error: 'Failed to fetch patients', message: patientsResult.error.message },
        { status: 500 }
      )
    }

    const treatments: TreatmentData[] = (treatmentsResult.data || [])
      .filter(row => row.patient_id)
      .map(row => ({
        id: row.id,
        service_id: row.service_id,
        patient_id: row.patient_id,
        treatment_date: row.treatment_date,
        price_cents: Number(row.price_cents || 0),
        variable_cost_cents: Number(row.variable_cost_cents || 0),
        fixed_per_minute_cents: Number(row.fixed_cost_per_minute_cents ?? 0),
        minutes: Number(row.minutes ?? 0),
        margin_pct: Number(row.margin_pct ?? 0),
        status: row.status || 'pending',
      }))

    const patients: PatientData[] = (patientsResult.data || []).map(row => ({
      id: row.id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      created_at: row.created_at || new Date().toISOString(),
    }))

    // Use the already-filtered data from the date range (no more hardcoded "current month")
    const periodTreatments = treatments
    const periodPatients = patients

    const completedPeriod = periodTreatments.filter(t => t.status === 'completed')
    const revenuePeriod = completedPeriod.reduce((sum, t) => sum + (t.price_cents || 0), 0)
    const margins = completedPeriod.map(t => t.margin_pct || 0)
    const averageMargin = margins.length > 0
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0

    const dashboardData = {
      patientsMonth: periodPatients.length,
      treatmentsMonth: periodTreatments.length,
      revenueMonth: revenuePeriod,
      averageMargin: Math.round(averageMargin),
    }

    // Calculate days in the selected period for accurate avgPatientsPerDay
    const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    const insights = generateBusinessInsights(treatments, patients)
    const kpis = calculateKPIs(treatments, patients, {
      daysInPeriod: periodDays,
      totalPatients: periodPatients.length
    })

    return NextResponse.json({
      data: {
        clinicId,
        range: { from: startISO, to: endISO },
        counts: {
          treatments: treatments.length,
          patients: patients.length,
        },
        dashboard: dashboardData,
        insights,
        kpis,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/reports/summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
