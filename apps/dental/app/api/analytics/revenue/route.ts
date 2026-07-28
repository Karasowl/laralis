/**
 * Analytics: Revenue
 *
 * GET /api/analytics/revenue
 * Returns revenue data filtered by date range
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

// Replicates the exact Supabase read for the revenue branch:
//   .from('treatments').select('treatment_date, price_cents')
//     .eq('clinic_id', clinicId)
//     [.gte('treatment_date', startDate)] [.lte('treatment_date', endDate)]
// No status filter is applied (parity with the Supabase path). Date columns
// are ISO date strings (YYYY-MM-DD), so lexicographic string comparison matches
// Postgres range filtering for the same format. Money stays in integer cents.
async function getRevenueTreatmentsFromConvex(
  clinicId: string,
  startDate: string | null,
  endDate: string | null
) {
  const rows = (await listConvexDocumentsByClinic('treatments', clinicId, 10000)) as ImportedRecord[]

  return rows
    .filter((row) => {
      const treatmentDate = String(row.treatment_date || '')
      if (startDate && treatmentDate < startDate) return false
      if (endDate && treatmentDate > endDate) return false
      return true
    })
    .map(normalizeConvexRecord)
    .map((row) => ({
      treatment_date: (row as ImportedRecord).treatment_date,
      price_cents: (row as ImportedRecord).price_cents,
    }))
}

export const GET = withPermission('financial_reports.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const groupBy = searchParams.get('group_by') || 'day'
    const clinicId = context.clinicId

    let treatments: Array<{ treatment_date: string; price_cents: number | null }> | null = null

    if (shouldReturnConvexData('treatments')) {
      treatments = await getRevenueTreatmentsFromConvex(clinicId, startDate, endDate)
    } else {
      // Build query
      let query = supabaseAdmin
        .from('treatments')
        .select('treatment_date, price_cents')
        .eq('clinic_id', clinicId)

      if (startDate) {
        query = query.gte('treatment_date', startDate)
      }
      if (endDate) {
        query = query.lte('treatment_date', endDate)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      treatments = data
    }

    // Calculate total revenue
    const totalRevenueCents = treatments?.reduce(
      (sum, t) => sum + (t.price_cents || 0),
      0
    ) || 0

    // Group by date
    const revenueByDate = treatments?.reduce(
      (acc, treatment) => {
        const date = treatment.treatment_date
        if (!acc[date]) {
          acc[date] = 0
        }
        acc[date] += treatment.price_cents || 0
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      total_revenue_cents: totalRevenueCents,
      revenue_by_date: revenueByDate,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
      treatments_count: treatments?.length || 0,
    })
  } catch (error) {
    console.error('[API /analytics/revenue] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch revenue data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
