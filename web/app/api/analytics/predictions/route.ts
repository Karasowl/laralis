import { NextRequest, NextResponse } from 'next/server'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { generatePrediction } from '@/lib/calc/predictions'

export const dynamic = 'force-dynamic'

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
        { error: clinicContext.error, message: clinicContext.message },
        { status: clinicContext.status }
      )
    }

    const { clinicId } = clinicContext

    // Get historical data from last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const startDate = twelveMonthsAgo.toISOString().split('T')[0]

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
