import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { generatePrediction } from '@/lib/calc/predictions'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Replicates the Supabase read path for predictions using Convex as the source:
 *   .from('treatments')
 *   .select('price_cents, treatment_date')
 *   .eq('clinic_id', clinicId)
 *   .gte('treatment_date', startDate)   // lexicographic-safe on YYYY-MM-DD
 *   .order('treatment_date', { ascending: true })
 *
 * The same raw rows are fed into the shared generatePrediction() calc, so the
 * numeric result is identical to the Supabase branch.
 */
async function getPredictionTreatmentsFromConvex(clinicId: string, startDate: string) {
  const rows = await listConvexDocumentsByClinic('treatments', clinicId, 10000) as ImportedRecord[]

  return rows
    .map(normalizeConvexRecord)
    .filter((row) => String(row.treatment_date || '') >= startDate)
    .sort((a, b) => String(a.treatment_date || '').localeCompare(String(b.treatment_date || '')))
    .map((row) => ({
      price_cents: Number(row.price_cents) || 0,
      treatment_date: String(row.treatment_date),
    }))
}

/**
 * GET /api/analytics/predictions
 * Returns revenue predictions based on historical treatment data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cookieStore = cookies()

    // Resolve clinic context
    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'financial_reports.view')
    if (forbidden) return forbidden

    // Get historical data from last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const startDate = twelveMonthsAgo.toISOString().split('T')[0]

    if (shouldReturnConvexData('treatments')) {
      const convexTreatments = await getPredictionTreatmentsFromConvex(clinicId, startDate)
      const convexPrediction = generatePrediction(convexTreatments)

      if (!convexPrediction) {
        return NextResponse.json({
          data: null,
          message: 'Insufficient data for predictions',
          minimumMonthsRequired: 1,
        })
      }

      return NextResponse.json({
        data: {
          nextMonth: convexPrediction.nextMonth,
          nextQuarter: convexPrediction.nextQuarter,
          yearEnd: convexPrediction.yearEnd,
          confidence: convexPrediction.confidence,
          trend: convexPrediction.trend.direction,
          monthsOfData: convexPrediction.monthsOfData,
        },
      })
    }

    const { data: treatments, error } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, treatment_date')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', startDate)
      .order('treatment_date', { ascending: true })

    if (error) {
      console.error('[predictions] Error fetching treatments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch treatment data', message: error.message },
        { status: 500 }
      )
    }

    // Generate prediction
    const prediction = generatePrediction(treatments || [])

    if (!prediction) {
      return NextResponse.json({
        data: null,
        message: 'Insufficient data for predictions',
        minimumMonthsRequired: 1,
      })
    }

    return NextResponse.json({
      data: {
        nextMonth: prediction.nextMonth,
        nextQuarter: prediction.nextQuarter,
        yearEnd: prediction.yearEnd,
        confidence: prediction.confidence,
        trend: prediction.trend.direction,
        monthsOfData: prediction.monthsOfData,
      },
    })
  } catch (error) {
    console.error('[predictions] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
