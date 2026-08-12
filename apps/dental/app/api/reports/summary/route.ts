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
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { collectedRevenueCents } from '@/lib/calc/metrics'
import { parseLocalDate, formatDateToISO } from '@/lib/date-utils'
import {
  calculateWorkingDaysInRange,
  estimateConfiguredWorkingDaysInRange,
  getEffectivePattern,
  type WorkingDaysConfig,
} from '@/lib/calc/dates'
import { getFirstTreatmentDateByPatient } from '@/lib/calc/patient-acquisition'

const querySchema = z.object({
  clinicId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

const DEFAULT_MONTH_LOOKBACK = 6

type ImportedRecord = Record<string, any>

// Strip the FULL Convex metadata set so the row matches a flat Supabase row.
function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Convex read branch for reports/summary.
 *
 * The Supabase path issues TWO independent flat queries (treatments + patients)
 * with the SAME column subsets, and the join (treatments -> patients by patient_id)
 * happens downstream inside @/lib/analytics in memory. There is NO nested .select()
 * here, so no FK-reassembly of nested objects is required: we simply reproduce the
 * two flat row sets with identical column subset + filtering, then feed them to the
 * exact same calculation functions for byte-identical output.
 *
 * Both `treatments` and `patients` carry a NOT NULL clinic_id (migration 16), so both
 * are clinic-scoped and use listConvexDocumentsByClinic (NOT listConvexTable).
 */
async function getReportsSummaryRows(clinicId: string, startISO: string, endISO: string) {
  const [treatmentsRaw, patientsRaw] = await Promise.all([
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  // Mirror Supabase: treatments filtered by treatment_date in [startISO, endISO].
  const treatmentRowsInRange = (treatmentsRaw || [])
    .map((row) => normalizeConvexRecord(row) as ImportedRecord)
    .filter((row) => {
      // slice(0,10) so a full ISO timestamp can't fall outside the
      // [startISO,endISO] DATE window, matching Postgres date coercion.
      const date = String(row.treatment_date || '').slice(0, 10)
      return date >= startISO && date <= endISO
    })

  const firstTreatmentByPatient = new Map<string, string>()
  for (const raw of treatmentsRaw || []) {
    const row = normalizeConvexRecord(raw) as ImportedRecord
    if (!row.patient_id || row.status === 'cancelled') continue
    const date = String(row.treatment_date || '').slice(0, 10)
    if (!date) continue
    const current = firstTreatmentByPatient.get(String(row.patient_id))
    if (!current || date < current) firstTreatmentByPatient.set(String(row.patient_id), date)
  }

  // Mirror Supabase: .filter(row => row.patient_id) then map to the same TreatmentData shape.
  const treatments: TreatmentData[] = treatmentRowsInRange
    .filter((row) => row.patient_id)
    .map((row) => ({
      id: row.id,
      service_id: row.service_id,
      patient_id: row.patient_id,
      treatment_date: row.treatment_date,
      price_cents: Number(row.price_cents || 0),
      amount_paid_cents: Number(row.amount_paid_cents || 0),
      is_paid: row.is_paid === true,
      variable_cost_cents: Number(row.variable_cost_cents || 0),
      fixed_per_minute_cents: Number(row.fixed_cost_per_minute_cents ?? 0),
      minutes: Number(row.minutes ?? 0),
      margin_pct: Number(row.margin_pct ?? 0),
      status: row.status || 'pending',
    })) as TreatmentData[]

  // Mirror Supabase: patients filtered by computed patientDate in [startISO, endISO].
  const patients: PatientData[] = (patientsRaw || [])
    .map((row) => normalizeConvexRecord(row) as ImportedRecord)
    .filter((row) => {
      const date = firstTreatmentByPatient.get(String(row.id)) || ''
      return date >= startISO && date <= endISO
    })
    .map((row) => ({
      id: row.id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      created_at: firstTreatmentByPatient.get(String(row.id)) || '',
    }))

  return { treatments, patients }
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

    const endDate = to ? parseLocalDate(to) : defaultRangeEnd
    if (Number.isNaN(endDate.getTime())) {
      endDate.setTime(defaultRangeEnd.getTime())
    }

    const startDate = from ? parseLocalDate(from) : new Date(endDate)
    if (Number.isNaN(startDate.getTime())) {
      startDate.setTime(endDate.getTime())
    }

    if (!from) {
      startDate.setMonth(startDate.getMonth() - DEFAULT_MONTH_LOOKBACK)
      startDate.setDate(1)
    }

    const startISO = formatDateToISO(startDate)
    const endISO = formatDateToISO(endDate)

    let treatments: TreatmentData[]
    let patients: PatientData[]

    if (shouldReturnConvexData('treatments')) {
      // Convex read branch (flag-gated). Auth + clinic scoping already enforced by
      // withPermission('financial_reports.view') -> context.clinicId. No extra guard needed.
      const convexRows = await getReportsSummaryRows(clinicId, startISO, endISO)
      treatments = convexRows.treatments
      patients = convexRows.patients
    } else {
      const [treatmentsResult, patientsResult] = await Promise.all([
        supabaseAdmin
          .from('treatments')
          .select(
            'id, patient_id, service_id, treatment_date, status, price_cents, amount_paid_cents, is_paid, variable_cost_cents, fixed_cost_per_minute_cents, margin_pct, minutes'
          )
          .eq('clinic_id', clinicId)
          .gte('treatment_date', startISO)
          .lte('treatment_date', endISO),
        supabaseAdmin
          .from('patients')
          .select('id, first_name, last_name, first_visit_date, acquisition_date, created_at')
          .eq('clinic_id', clinicId)
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

      treatments = (treatmentsResult.data || [])
        .filter(row => row.patient_id)
        .map(row => ({
          id: row.id,
          service_id: row.service_id,
          patient_id: row.patient_id,
          treatment_date: row.treatment_date,
          price_cents: Number(row.price_cents || 0),
          amount_paid_cents: Number(row.amount_paid_cents || 0),
          is_paid: row.is_paid === true,
          variable_cost_cents: Number(row.variable_cost_cents || 0),
          fixed_per_minute_cents: Number(row.fixed_cost_per_minute_cents ?? 0),
          minutes: Number(row.minutes ?? 0),
          margin_pct: Number(row.margin_pct ?? 0),
          status: row.status || 'pending',
        })) as TreatmentData[]

      const firstTreatmentByPatient = await getFirstTreatmentDateByPatient(clinicId)
      patients = (patientsResult.data || [])
        .filter(row => {
          const date = firstTreatmentByPatient.get(String(row.id)) || ''
          return date >= startISO && date <= endISO
        })
        .map(row => ({
          id: row.id,
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          created_at: firstTreatmentByPatient.get(String(row.id)) || '',
        }))
    }

    // Use the already-filtered data from the date range (no more hardcoded "current month")
    const periodTreatments = treatments
    const periodPatients = patients

    const completedPaidPeriod = periodTreatments.filter(t => collectedRevenueCents(t) > 0)
    const revenuePeriod = completedPaidPeriod.reduce((sum, t) => sum + collectedRevenueCents(t), 0)
    const completedPeriod = periodTreatments.filter(t => t.status === 'completed')
    const billedPeriod = completedPeriod.reduce((sum, treatment) => sum + Math.max(0, treatment.price_cents || 0), 0)
    const costPeriod = completedPeriod.reduce(
      (sum, treatment) => sum
        + Math.max(0, treatment.variable_cost_cents || 0)
        + Math.max(0, treatment.fixed_per_minute_cents || 0) * Math.max(0, treatment.minutes || 0),
      0
    )
    const averageMargin = billedPeriod > 0
      ? ((billedPeriod - costPeriod) / billedPeriod) * 100
      : 0

    const dashboardData = {
      patientsMonth: periodPatients.length,
      treatmentsMonth: periodTreatments.length,
      revenueMonth: revenuePeriod,
      averageMargin: Math.round(averageMargin),
    }

    // Calculate days in the selected period for accurate avgPatientsPerDay
    const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

    let timeSettings: ImportedRecord | null = null
    if (shouldReturnConvexData('settings_time')) {
      const settingsRows = await listConvexDocumentsByClinic('settings_time', clinicId, 10) as ImportedRecord[]
      timeSettings = settingsRows
        .map(row => normalizeConvexRecord(row))
        .filter(Boolean)
        .sort((a, b) => String(b?.updated_at || '').localeCompare(String(a?.updated_at || '')))[0] || null
    } else {
      const { data: settingsRow, error: settingsError } = await supabaseAdmin
        .from('settings_time')
        .select('work_days, hours_per_day, working_days_config')
        .eq('clinic_id', clinicId)
        .maybeSingle()
      if (settingsError) {
        console.warn('[reports/summary] Failed to load time settings', settingsError.message)
      }
      timeSettings = settingsRow
    }

    const configuredWorkDays = Math.max(1, Number(timeSettings?.work_days || 20))
    const hoursPerDay = Math.max(0, Number(timeSettings?.hours_per_day || 0))
    const workingDaysConfig = timeSettings?.working_days_config as WorkingDaysConfig | undefined
    const workingDaysResult = workingDaysConfig
      ? calculateWorkingDaysInRange(startDate, endDate, getEffectivePattern(workingDaysConfig))
      : estimateConfiguredWorkingDaysInRange(startDate, endDate, configuredWorkDays)
    const workingDaysInPeriod = Math.max(1, workingDaysResult.workingDays)

    const insights = generateBusinessInsights(treatments, patients, {
      workingDaysInPeriod,
      hoursPerDay,
    })
    const kpis = calculateKPIs(treatments, patients, {
      daysInPeriod: periodDays,
      workingDaysInPeriod,
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
