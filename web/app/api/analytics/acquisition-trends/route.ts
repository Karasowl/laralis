import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { buildBuckets, chooseGranularity, findBucketKey } from '@/lib/calc/buckets'
import { getFirstTreatmentDateByPatient } from '@/lib/calc/patient-acquisition'

export const dynamic = 'force-dynamic'

interface AcquisitionPoint {
  month: string // Kept as `month` for backward compatibility with the chart's dataKey.
  patients: number
  projection?: number
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

    // Resolve the effective inclusive date range.
    const now = new Date()
    const rangeStart = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const rangeEnd = endDate ? new Date(endDate) : now

    // Adaptive granularity: short ranges -> daily buckets, etc.
    const granularity = chooseGranularity(rangeStart, rangeEnd)
    const buckets = buildBuckets(rangeStart, rangeEnd, granularity)

    // "New patient" is defined by the date of the patient's FIRST treatment
    // (the moment they actually came in), NOT patients.created_at. This
    // matches the dashboard convention used across all marketing analytics.
    const firstTreatmentDate = await getFirstTreatmentDateByPatient(clinicContext.clinicId)

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

  } catch (error) {
    console.error('[AcquisitionTrends] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
