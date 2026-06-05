import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { buildBuckets, chooseGranularity, findBucketKey } from '@/lib/calc/buckets'
import { getFirstTreatmentDateByPatient } from '@/lib/calc/patient-acquisition'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

interface AcquisitionPoint {
  month: string // Kept as `month` for backward compatibility with the chart's dataKey.
  patients: number
  projection?: number
}

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

/**
 * Convex replica of getFirstTreatmentDateByPatient() for this route.
 *
 * Replicates the Supabase read path exactly:
 *   .from('treatments')
 *   .select('patient_id, treatment_date')
 *   .eq('clinic_id', clinicId)
 *   .not('treatment_date', 'is', null)
 *   .neq('status', 'cancelled')
 *
 * then reduces to `patientId -> earliest ISO (YYYY-MM-DD)` using the SAME
 * lexicographic min (`iso < existing`) the shared helper uses. The resulting
 * Map is fed into the identical downstream bucketing/regression calc, so the
 * numeric output is byte-identical to the Supabase branch.
 */
async function getFirstTreatmentDateByPatientFromConvex(
  clinicId: string
): Promise<Map<string, string>> {
  const rows = await listConvexDocumentsByClinic('treatments', clinicId, 10000) as ImportedRecord[]

  const firstDate = new Map<string, string>()
  for (const raw of rows) {
    const t = normalizeConvexRecord(raw)
    // Supabase filters: treatment_date NOT NULL, status != 'cancelled'.
    if (t.treatment_date == null) continue
    if (t.status == null || t.status === 'cancelled') continue

    const pid = t.patient_id
    if (pid == null) continue
    const iso = String(t.treatment_date || '').slice(0, 10)
    if (!iso) continue
    const existing = firstDate.get(String(pid))
    if (!existing || iso < existing) firstDate.set(String(pid), iso)
  }
  return firstDate
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cookieStore = await cookies()

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error },
        { status: 403 }
      )
    }

    const months = parseInt(searchParams.get('months') || '12', 10)
    const projectionMonths = parseInt(searchParams.get('projectionMonths') || '3', 10)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Resolve the effective inclusive date range. Date-only strings
    // (YYYY-MM-DD) are parsed by `new Date()` as UTC midnight, which in
    // negative-UTC timezones (e.g. America/Mexico_City) shifts to the
    // previous day in local time and skews bucket boundaries. Append
    // T00:00:00 to force local-time interpretation.
    const now = new Date()
    const rangeStart = startDate
      ? new Date(`${startDate}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const rangeEnd = endDate ? new Date(`${endDate}T23:59:59`) : now

    // Adaptive granularity: short ranges -> daily buckets, etc.
    const granularity = chooseGranularity(rangeStart, rangeEnd)
    const buckets = buildBuckets(rangeStart, rangeEnd, granularity)

    // "New patient" is defined by the date of the patient's FIRST treatment
    // (the moment they actually came in), NOT patients.created_at. This
    // matches the dashboard convention used across all marketing analytics.
    //
    // Flag-gated Convex read: swap ONLY the data source for the first-treatment
    // map. The downstream bucketing/regression calc below is shared and
    // untouched, so both branches produce identical numbers.
    const firstTreatmentDate = shouldReturnConvexData('treatments')
      ? await getFirstTreatmentDateByPatientFromConvex(clinicContext.clinicId)
      : await getFirstTreatmentDateByPatient(clinicContext.clinicId)

    const counts = new Map<string, number>()
    buckets.forEach(b => counts.set(b.key, 0))

    firstTreatmentDate.forEach((iso) => {
      const key = findBucketKey(buckets, iso)
      if (key) counts.set(key, (counts.get(key) || 0) + 1)
    })

    const historical: AcquisitionPoint[] = buckets.map(b => ({
      month: b.label,
      patients: counts.get(b.key) || 0,
    }))

    // Linear regression projection. Only meaningful for monthly granularity
    // (projecting "next 3 days" doesn't add useful signal). Skip otherwise.
    const n = historical.length
    if (n < 2 || granularity !== 'month') {
      return NextResponse.json({
        granularity,
        data: historical,
      })
    }

    const sumX = historical.reduce((sum, _, i) => sum + i, 0)
    const sumY = historical.reduce((sum, d) => sum + d.patients, 0)
    const sumXY = historical.reduce((sum, d, i) => sum + (i * d.patients), 0)
    const sumX2 = historical.reduce((sum, _, i) => sum + (i * i), 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const projection: AcquisitionPoint[] = []
    for (let i = 1; i <= projectionMonths; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthLabel = futureDate
        .toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
        .replace(/^./, c => c.toUpperCase())
      const projectedValue = Math.max(0, Math.round(slope * (n + i - 1) + intercept))
      projection.push({
        month: monthLabel,
        patients: 0,
        projection: projectedValue,
      })
    }

    return NextResponse.json({
      granularity,
      data: [...historical, ...projection],
    })

  } catch (error: any) {
    // Log all server-side detail for diagnosis without leaking schema
    // info to the client. Same pattern as channel-roi/cac-trend.
    console.error('[AcquisitionTrends] Unexpected error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
