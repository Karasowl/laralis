import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { detectWorkingDayPattern, type TreatmentRecord } from '@/lib/calc/dates'

export const dynamic = 'force-dynamic'


/**
 * GET /api/equilibrium/working-days
 *
 * Analyzes historical treatment data to detect working day patterns
 * Query params:
 * - clinicId: Required. The clinic ID to analyze
 * - lookbackDays: Optional. Number of days to look back (default: 60)
 */
export const GET = withPermission('break_even.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '60')

    if (lookbackDays < 1 || lookbackDays > 365) {
      return NextResponse.json(
        { error: 'lookbackDays must be between 1 and 365' },
        { status: 400 }
      )
    }

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    const { data: treatments, error } = await supabaseAdmin
      .from('treatments')
      .select('treatment_date')
      .eq('clinic_id', context.clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', cutoffDateStr)
      .order('treatment_date', { ascending: true })

    if (error) {
      console.error('Error fetching treatments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch treatment data' },
        { status: 500 }
      )
    }

    const treatmentRecords: TreatmentRecord[] = (treatments || []).map(t => ({
      treatment_date: t.treatment_date
    }))

    const detectedPattern = detectWorkingDayPattern(
      treatmentRecords,
      lookbackDays
    )

    return NextResponse.json({
      detected: detectedPattern,
      lookbackDays,
      queriedFrom: cutoffDateStr,
      totalTreatments: treatmentRecords.length
    })

  } catch (error) {
    console.error('Error in working-days analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
