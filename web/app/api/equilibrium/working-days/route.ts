import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectWorkingDayPattern, type TreatmentRecord } from '@/lib/calc/dates'

/**
 * GET /api/equilibrium/working-days
 *
 * Analyzes historical treatment data to detect working day patterns
 * Query params:
 * - clinicId: Required. The clinic ID to analyze
 * - lookbackDays: Optional. Number of days to look back (default: 60)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '60')

    if (!clinicId) {
      return NextResponse.json(
        { error: 'clinicId is required' },
        { status: 400 }
      )
    }

    if (lookbackDays < 1 || lookbackDays > 365) {
      return NextResponse.json(
        { error: 'lookbackDays must be between 1 and 365' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user has access to this clinic
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    // Query treatments in the lookback period
    // RLS policies will ensure user only sees treatments from their clinics
    const { data: treatments, error } = await supabase
      .from('treatments')
      .select('treatment_date')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed') // Only completed treatments
      .gte('treatment_date', cutoffDateStr)
      .order('treatment_date', { ascending: true })

    if (error) {
      console.error('Error fetching treatments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch treatment data' },
        { status: 500 }
      )
    }

    // Cast to TreatmentRecord type
    const treatmentRecords: TreatmentRecord[] = (treatments || []).map(t => ({
      treatment_date: t.treatment_date
    }))

    // Detect pattern
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
}
