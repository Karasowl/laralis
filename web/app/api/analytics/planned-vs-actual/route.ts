/**
 * Analytics: Planned vs Actual Costs
 *
 * GET /api/analytics/planned-vs-actual
 * Compares planned fixed costs (used for pricing) vs actual expenses
 *
 * This is a UNIQUE differentiator vs competitors:
 * - Most apps only track actual expenses
 * - Laralis shows variance between what you PLANNED (fixed_costs for pricing)
 *   and what you ACTUALLY spent (expenses)
 * - Helps identify cost overruns and optimize pricing
 *
 * Query params:
 * - clinic_id (required)
 * - start_date (optional, YYYY-MM-DD)
 * - end_date (optional, YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface PlannedCost {
  name: string
  amount_cents: number
}

interface ActualExpense {
  category: string
  amount_cents: number
  expense_category?: string
}

interface CategoryVariance {
  category: string
  planned_cents: number
  actual_cents: number
  variance_cents: number
  variance_pct: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
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

    // ===== 1. Get PLANNED fixed costs (configured for pricing) =====
    const { data: fixedCosts, error: fixedCostsError } = await supabase
      .from('fixed_costs')
      .select('name, amount_cents')
      .eq('clinic_id', clinicId)

    if (fixedCostsError) {
      throw fixedCostsError
    }

    const totalPlannedCents = (fixedCosts as PlannedCost[])?.reduce(
      (sum, cost) => sum + (cost.amount_cents || 0),
      0
    ) || 0

    // ===== 2. Get ACTUAL fixed costs (from expenses where is_variable = false) =====
    let expensesQuery = supabase
      .from('expenses')
      .select('category, amount_cents, expense_category')
      .eq('clinic_id', clinicId)
      .eq('is_variable', false) // Only fixed costs

    if (startDate) {
      expensesQuery = expensesQuery.gte('expense_date', startDate)
    }
    if (endDate) {
      expensesQuery = expensesQuery.lte('expense_date', endDate)
    }

    const { data: expenses, error: expensesError } = await expensesQuery

    if (expensesError) {
      throw expensesError
    }

    const totalActualCents = (expenses as ActualExpense[])?.reduce(
      (sum, exp) => sum + (exp.amount_cents || 0),
      0
    ) || 0

    // ===== 3. Calculate variance =====
    const totalVarianceCents = totalActualCents - totalPlannedCents
    const totalVariancePct = totalPlannedCents > 0
      ? (totalVarianceCents / totalPlannedCents) * 100
      : 0

    // ===== 4. Breakdown by category =====
    // Group planned costs by name
    const plannedByCategory: Record<string, number> = {}
    ;(fixedCosts as PlannedCost[])?.forEach((cost) => {
      const category = cost.name || 'Other'
      plannedByCategory[category] = (plannedByCategory[category] || 0) + (cost.amount_cents || 0)
    })

    // Group actual expenses by expense_category (or fallback to category)
    const actualByCategory: Record<string, number> = {}
    ;(expenses as ActualExpense[])?.forEach((exp) => {
      const category = exp.expense_category || exp.category || 'other'
      actualByCategory[category] = (actualByCategory[category] || 0) + (exp.amount_cents || 0)
    })

    // Combine and calculate variance per category
    const allCategories = new Set([
      ...Object.keys(plannedByCategory),
      ...Object.keys(actualByCategory)
    ])

    const categoryBreakdown: CategoryVariance[] = Array.from(allCategories).map((category) => {
      const planned = plannedByCategory[category] || 0
      const actual = actualByCategory[category] || 0
      const variance = actual - planned
      const variancePct = planned > 0 ? (variance / planned) * 100 : 0

      return {
        category,
        planned_cents: planned,
        actual_cents: actual,
        variance_cents: variance,
        variance_pct: Math.round(variancePct * 10) / 10
      }
    })

    // Sort by absolute variance (largest first)
    categoryBreakdown.sort((a, b) =>
      Math.abs(b.variance_cents) - Math.abs(a.variance_cents)
    )

    // ===== 5. Return Response =====
    return NextResponse.json({
      total_planned_cents: totalPlannedCents,
      total_actual_cents: totalActualCents,
      total_variance_cents: totalVarianceCents,
      total_variance_pct: Math.round(totalVariancePct * 10) / 10,
      category_breakdown: categoryBreakdown,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
      planned_count: fixedCosts?.length || 0,
      actual_count: expenses?.length || 0,
      metadata: {
        description: 'Planned (fixed_costs for pricing) vs Actual (expenses where is_variable=false)',
        insight: totalVarianceCents > 0
          ? 'Spending more than planned - consider adjusting prices or reducing costs'
          : totalVarianceCents < 0
          ? 'Spending less than planned - opportunity to reinvest or adjust pricing'
          : 'On track with planned costs'
      }
    })

  } catch (error) {
    console.error('Error in GET /api/analytics/planned-vs-actual:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
