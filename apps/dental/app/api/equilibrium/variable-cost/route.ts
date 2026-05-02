import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'

export const dynamic = 'force-dynamic'


const DEFAULT_LOOKBACK_DAYS = 90

export const GET = withPermission('break_even.view', async (request, context) => {
  try {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - DEFAULT_LOOKBACK_DAYS)

    const fromISO = from.toISOString().split('T')[0]
    const toISO = today.toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, variable_cost_cents')
      .eq('clinic_id', context.clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', fromISO)
      .lte('treatment_date', toISO)

    if (error) {
      console.error('[equilibrium/variable-cost] Failed to fetch treatments', error)
      return NextResponse.json(
        { error: 'Failed to fetch variable cost data', message: error.message },
        { status: 500 }
      )
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
