import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'


const DEFAULT_LOOKBACK_DAYS = 90

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

// Replicates the exact Supabase read for the variable-cost branch:
//   .from('treatments').select('price_cents, variable_cost_cents')
//     .eq('clinic_id', clinicId).eq('status', 'completed')
//     .gte('treatment_date', fromISO).lte('treatment_date', toISO)
// Date columns are ISO date strings (YYYY-MM-DD), so lexicographic string
// comparison matches Postgres range filtering for the same format.
async function getVariableCostTreatmentsFromConvex(
  clinicId: string,
  fromISO: string,
  toISO: string
) {
  const rows = (await listConvexDocumentsByClinic('treatments', clinicId, 10000)) as ImportedRecord[]

  return rows
    .filter((row) => {
      if (String(row.status || '') !== 'completed') return false
      const treatmentDate = String(row.treatment_date || '')
      if (!treatmentDate) return false
      return treatmentDate >= fromISO && treatmentDate <= toISO
    })
    .map(normalizeConvexRecord)
    .map((row) => ({
      price_cents: (row as ImportedRecord).price_cents,
      variable_cost_cents: (row as ImportedRecord).variable_cost_cents,
    }))
}

export const GET = withPermission('break_even.view', async (request, context) => {
  try {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - DEFAULT_LOOKBACK_DAYS)

    const fromISO = from.toISOString().split('T')[0]
    const toISO = today.toISOString().split('T')[0]

    let data: Array<{ price_cents: unknown; variable_cost_cents: unknown }> | null = null

    if (shouldReturnConvexData('treatments')) {
      data = await getVariableCostTreatmentsFromConvex(context.clinicId, fromISO, toISO)
    } else {
      const result = await supabaseAdmin
        .from('treatments')
        .select('price_cents, variable_cost_cents')
        .eq('clinic_id', context.clinicId)
        .eq('status', 'completed')
        .gte('treatment_date', fromISO)
        .lte('treatment_date', toISO)

      if (result.error) {
        console.error('[equilibrium/variable-cost] Failed to fetch treatments', result.error)
        return NextResponse.json(
          { error: 'Failed to fetch variable cost data', message: result.error.message },
          { status: 500 }
        )
      }

      data = result.data
    }

    const totals = (data || []).reduce(
      (acc, row) => {
        const price = Number(row.price_cents || 0)
        const variable = Number(row.variable_cost_cents || 0)
        if (price > 0) {
          acc.revenueCents += price
          acc.variableCostCents += Math.min(variable, price)
          acc.sampleSize += 1
        }
        return acc
      },
      { revenueCents: 0, variableCostCents: 0, sampleSize: 0 }
    )

    const percentage =
      totals.revenueCents > 0
        ? Math.max(
            0,
            Math.min(100, (totals.variableCostCents / totals.revenueCents) * 100)
          )
        : 0

    return NextResponse.json({
      data: {
        variableCostPercentage: percentage,
        revenueCents: totals.revenueCents,
        variableCostCents: totals.variableCostCents,
        sampleSize: totals.sampleSize,
        period: {
          from: fromISO,
          to: toISO,
          days: DEFAULT_LOOKBACK_DAYS
        }
      }
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/equilibrium/variable-cost:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
