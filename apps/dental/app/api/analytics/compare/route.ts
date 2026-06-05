/**
 * Analytics: Compare Periods
 *
 * GET /api/analytics/compare
 * Compares two time periods for revenue, expenses, and treatments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { verifyClinicAccess } from '@/lib/auth/verify-clinic-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

type PeriodStats = {
  revenue_cents: number
  expenses_cents: number
  profit_cents: number
  treatments_count: number
}

type PeriodResult = PeriodStats & { start: string; end: string }

/**
 * Shared changes-calculation + response assembly.
 * Keeps the Supabase and Convex branches byte-identical in shape and numbers.
 */
function buildComparisonResponse(period1: PeriodResult, period2: PeriodResult) {
  const revenueChange =
    period1.revenue_cents > 0
      ? ((period2.revenue_cents - period1.revenue_cents) / period1.revenue_cents) * 100
      : 0

  const expensesChange =
    period1.expenses_cents > 0
      ? ((period2.expenses_cents - period1.expenses_cents) / period1.expenses_cents) * 100
      : 0

  const profitChange =
    period1.profit_cents !== 0
      ? ((period2.profit_cents - period1.profit_cents) / Math.abs(period1.profit_cents)) * 100
      : 0

  const treatmentsChange =
    period1.treatments_count > 0
      ? ((period2.treatments_count - period1.treatments_count) / period1.treatments_count) * 100
      : 0

  return {
    period1,
    period2,
    changes: {
      revenue_pct: Math.round(revenueChange * 10) / 10,
      expenses_pct: Math.round(expensesChange * 10) / 10,
      profit_pct: Math.round(profitChange * 10) / 10,
      treatments_pct: Math.round(treatmentsChange * 10) / 10,
    },
  }
}

/**
 * Convex equivalent of the Supabase getPeriodStats helper.
 *
 * Mirrors EXACTLY the Supabase aggregation:
 *  - treatments: sum of price_cents where treatment_date in [startDate, endDate]
 *  - expenses:   sum of amount_cents where expense_date in [startDate, endDate]
 *  - NO status filter (the Supabase path sums every treatment in range)
 *  - Date filtering is lexicographic on YYYY-MM-DD (>= start, <= end), identical to gte/lte
 *  - Money stays in integer cents
 */
async function getComparisonFromConvex(
  clinicId: string,
  periods: Array<{ start: string; end: string }>
) {
  const [treatments, expenses] = await Promise.all([
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('expenses', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  const treatmentRows = treatments.map(normalizeConvexRecord)
  const expenseRows = expenses.map(normalizeConvexRecord)

  return periods.map(({ start, end }) => {
    const periodTreatments = treatmentRows.filter((t) => {
      const date = String(t.treatment_date || '')
      return date >= start && date <= end
    })

    const revenue = periodTreatments.reduce((sum, t) => sum + (t.price_cents || 0), 0)

    const totalExpenses = expenseRows.reduce((sum, e) => {
      const date = String(e.expense_date || '')
      if (date < start || date > end) return sum
      return sum + (e.amount_cents || 0)
    }, 0)

    return {
      revenue_cents: revenue,
      expenses_cents: totalExpenses,
      profit_cents: revenue - totalExpenses,
      treatments_count: periodTreatments.length,
    }
  })
}

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

    // Membership check guards BOTH branches (defense in depth). The Convex
    // read path has NO row-level security, so an explicit clinic-access check
    // is required before branching; the Supabase path benefits too.
    if (!(await verifyClinicAccess(user.id, clinicId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Convex read branch: same aggregation, same response shape, same numbers.
    // Branches BEFORE any supabase data query; auth above is preserved.
    if (shouldReturnConvexData('treatments')) {
      const [period1Stats, period2Stats] = await getComparisonFromConvex(clinicId, [
        { start: period1Start, end: period1End },
        { start: period2Start, end: period2End },
      ])

      return NextResponse.json(
        buildComparisonResponse(
          { ...period1Stats, start: period1Start, end: period1End },
          { ...period2Stats, start: period2Start, end: period2End }
        )
      )
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

    return NextResponse.json(
      buildComparisonResponse(
        { ...period1Stats, start: period1Start, end: period1End },
        { ...period2Stats, start: period2Start, end: period2End }
      )
    )
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
