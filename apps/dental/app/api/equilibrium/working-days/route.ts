import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { detectWorkingDayPattern, type TreatmentRecord } from '@/lib/calc/dates'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Replicate the Supabase read path against Convex:
 * select treatments where status = 'completed' and treatment_date >= cutoff,
 * ordered ascending by treatment_date, then keep only treatment_date.
 */
async function getCompletedTreatmentDatesFromConvex(
  clinicId: string,
  cutoffDateStr: string
): Promise<TreatmentRecord[]> {
  const rows = (await listConvexDocumentsByClinic('treatments', clinicId, 10000)) as ImportedRecord[]

  return rows
    .map(normalizeConvexRecord)
    .filter((row) => row.status === 'completed')
    .filter((row) => String(row.treatment_date ?? '') >= cutoffDateStr)
    .sort((a, b) => String(a.treatment_date ?? '').localeCompare(String(b.treatment_date ?? '')))
    .map((row) => ({ treatment_date: row.treatment_date }))
}


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

    if (shouldReturnConvexData('treatments')) {
      const treatmentRecords = await getCompletedTreatmentDatesFromConvex(
        context.clinicId,
        cutoffDateStr
      )

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
    }

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
