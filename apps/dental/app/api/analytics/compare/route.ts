/**
 * Analytics: Compare Periods
 *
 * GET /api/analytics/compare
 * Compares two time periods for revenue, expenses, and treatments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const period1Start = searchParams.get('period1_start')
    const period1End = searchParams.get('period1_end')
    const period2Start = searchParams.get('period2_start')
    const period2End = searchParams.get('period2_end')

    if (!clinicId || !period1Start || !period1End || !period2Start || !period2End) {
      return NextResponse.json(
        { error: 'clinic_id and both period dates are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Helper function to get period stats
    const getPeriodStats = async (startDate: string, endDate: string) => {
      // Revenue
      const { data: treatments } = await supabase
        .from('treatments')
        .select('price_cents')
        .eq('clinic_id', clinicId)
        .gte('treatment_date', startDate)
        .lte('treatment_date', endDate)

      const revenue = treatments?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0

      // Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount_cents')
        .eq('clinic_id', clinicId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)

      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_cents || 0), 0) || 0

      return {
        revenue_cents: revenue,
        expenses_cents: totalExpenses,
        profit_cents: revenue - totalExpenses,
        treatments_count: treatments?.length || 0,
      }
    }

    // Get stats for both periods
    const [period1Stats, period2Stats] = await Promise.all([
      getPeriodStats(period1Start, period1End),
      getPeriodStats(period2Start, period2End),
    ])

    // Calculate changes
    const revenueChange =
      period1Stats.revenue_cents > 0
        ? ((period2Stats.revenue_cents - period1Stats.revenue_cents) /
            period1Stats.revenue_cents) *
          100
        : 0

    const expensesChange =
      period1Stats.expenses_cents > 0
        ? ((period2Stats.expenses_cents - period1Stats.expenses_cents) /
            period1Stats.expenses_cents) *
          100
        : 0

    const profitChange =
      period1Stats.profit_cents !== 0
        ? ((period2Stats.profit_cents - period1Stats.profit_cents) /
            Math.abs(period1Stats.profit_cents)) *
          100
        : 0

    const treatmentsChange =
      period1Stats.treatments_count > 0
        ? ((period2Stats.treatments_count - period1Stats.treatments_count) /
            period1Stats.treatments_count) *
          100
        : 0

    return NextResponse.json({
      period1: {
        ...period1Stats,
        start: period1Start,
        end: period1End,
      },
      period2: {
        ...period2Stats,
        start: period2Start,
        end: period2End,
      },
      changes: {
        revenue_pct: Math.round(revenueChange * 10) / 10,
        expenses_pct: Math.round(expensesChange * 10) / 10,
        profit_pct: Math.round(profitChange * 10) / 10,
        treatments_pct: Math.round(treatmentsChange * 10) / 10,
      },
    })
  } catch (error) {
    console.error('[API /analytics/compare] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to compare periods',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
