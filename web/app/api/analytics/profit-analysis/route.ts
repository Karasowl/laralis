/**
 * Analytics: Profit Analysis
 *
 * GET /api/analytics/profit-analysis
 * Returns REAL profit based on actual recorded expenses.
 *
 * KEY INSIGHT: Configured fixed costs (from fixed_costs table) are for PRICING services,
 * not for calculating real profit. Real profit = what you actually have in hand.
 *
 * Formulas:
 * - Real Profit = Revenue from Treatments - Registered Expenses (from expenses table)
 *
 * The configured costs are returned for reference/comparison but NOT used in profit calc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Calculate the number of days in a period and the reference month's days for prorating
 */
function calculatePeriodInfo(startDate: string | null, endDate: string | null): {
  periodDays: number
  daysInMonth: number
} {
  if (!startDate || !endDate) {
    // Default to current month if no dates provided
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return { periodDays: daysInMonth, daysInMonth }
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const periodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end

  // Use the actual days in the start date's month for accurate proration
  // This ensures costs are prorated correctly based on the actual month length
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()

  return { periodDays, daysInMonth }
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

    // Calculate period days for prorating monthly costs
    const { periodDays, daysInMonth } = calculatePeriodInfo(startDate, endDate)

    // ===== 1. Get Revenue from completed treatments =====
    // Include variable_cost_cents for accurate gross profit calculation
    let treatmentsQuery = supabase
      .from('treatments')
      .select('price_cents, variable_cost_cents')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')

    if (startDate) {
      treatmentsQuery = treatmentsQuery.gte('treatment_date', startDate)
    }
    if (endDate) {
      treatmentsQuery = treatmentsQuery.lte('treatment_date', endDate)
    }

    const { data: treatments, error: treatmentsError } = await treatmentsQuery

    if (treatmentsError) {
      throw treatmentsError
    }

    const revenueCents = treatments?.reduce(
      (sum, t) => sum + (t.price_cents || 0),
      0
    ) || 0

    // ===== 2. Get Variable Costs from treatments (materials/supplies used) =====
    // IMPORTANT: Variable costs come from treatments.variable_cost_cents, NOT from expenses
    // This field is a snapshot of material costs at the time of treatment
    const variableCostsCents = treatments?.reduce(
      (sum, t) => sum + (t.variable_cost_cents || 0),
      0
    ) || 0

    // ===== 3. Get Expenses (for real fixed costs tracking) =====
    let expensesQuery = supabase
      .from('expenses')
      .select('amount_cents, is_variable')
      .eq('clinic_id', clinicId)

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

    // Real fixed costs from expenses table (actual recorded expenses)
    const fixedCostsRealCents = expenses?.reduce(
      (sum, e) => sum + (e.amount_cents || 0),
      0
    ) || 0

    // ===== 4. Get CONFIGURED Fixed Costs from fixed_costs table =====
    const { data: configuredFixedCosts, error: fixedCostsError } = await supabase
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId)

    if (fixedCostsError) {
      throw fixedCostsError
    }

    // Sum all configured monthly fixed costs
    const monthlyConfiguredFixedCents = configuredFixedCosts?.reduce(
      (sum, fc) => sum + (fc.amount_cents || 0),
      0
    ) || 0

    // Prorate to the selected period
    const fixedCostsConfiguredCents = Math.round(
      monthlyConfiguredFixedCents * periodDays / daysInMonth
    )

    // ===== 5. Get Assets for depreciation calculation =====
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('purchase_price_cents, depreciation_months, purchase_date')
      .eq('clinic_id', clinicId)

    if (assetsError) {
      throw assetsError
    }

    // Calculate monthly depreciation from all assets
    const monthlyDepreciationCents = assets?.reduce((sum, asset) => {
      const months = asset.depreciation_months || 1
      const monthlyDepreciation = Math.round((asset.purchase_price_cents || 0) / months)
      return sum + monthlyDepreciation
    }, 0) || 0

    // Prorate depreciation to the selected period
    const depreciationCents = Math.round(
      monthlyDepreciationCents * periodDays / daysInMonth
    )

    // ===== 6. Calculate Profit Metrics =====
    // KEY CHANGE: Use REGISTERED EXPENSES for real profit calculation
    // Configured costs are only for pricing services, not for profit calculation

    // Real Profit = Revenue - Registered Expenses
    // This tells you: "How much money do I actually have after paying what I paid?"
    const realProfitCents = revenueCents - fixedCostsRealCents
    const realMarginPct = revenueCents > 0
      ? (realProfitCents / revenueCents) * 100
      : 0

    // Theoretical Profit = Revenue - Variable Costs - Configured Fixed Costs - Depreciation
    // This tells you: "Am I pricing my services correctly?"
    const theoreticalCostsCents = variableCostsCents + fixedCostsConfiguredCents + depreciationCents
    const theoreticalProfitCents = revenueCents - theoreticalCostsCents
    const theoreticalMarginPct = revenueCents > 0
      ? (theoreticalProfitCents / revenueCents) * 100
      : 0

    // Difference shows if you're spending more or less than expected
    const differenceCents = realProfitCents - theoreticalProfitCents

    // Legacy metrics kept for backward compatibility
    const grossProfitCents = revenueCents - variableCostsCents
    const grossMarginPct = revenueCents > 0
      ? (grossProfitCents / revenueCents) * 100
      : 0

    // Use real profit as the "net profit" (what actually matters)
    const netProfitCents = realProfitCents
    const netMarginPct = realMarginPct

    // Total costs based on registered expenses
    const totalCostsCents = fixedCostsRealCents

    // ===== 7. Return Response =====
    return NextResponse.json({
      revenue_cents: revenueCents,
      costs: {
        // Registered expenses (what you actually paid)
        expenses_cents: fixedCostsRealCents,
        // For reference: configured vs real
        variable_cents: variableCostsCents,               // Materials from treatments
        configured_fixed_cents: fixedCostsConfiguredCents, // From fixed_costs table (prorated)
        depreciation_cents: depreciationCents,             // From assets (prorated, informational)
        total_cents: totalCostsCents
      },
      profits: {
        // NEW: Real profit based on registered expenses
        real_profit_cents: realProfitCents,
        real_margin_pct: Math.round(realMarginPct * 10) / 10,
        // Theoretical profit (if you spent exactly what you configured)
        theoretical_profit_cents: theoreticalProfitCents,
        theoretical_margin_pct: Math.round(theoreticalMarginPct * 10) / 10,
        // Difference: positive = spent less than expected, negative = spent more
        difference_cents: differenceCents,
        // Legacy fields for backward compatibility
        gross_profit_cents: grossProfitCents,
        gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
        net_profit_cents: netProfitCents,
        net_margin_pct: Math.round(netMarginPct * 10) / 10
      },
      benchmarks: {
        gross_margin_target_pct: 85,        // 85-90% for dental clinics
        operating_margin_target_pct: 20,    // 15-25% for small clinics
        ebitda_margin_target_pct: 17.5,     // MGMA 2021 average
        overhead_ratio_target_pct: 63       // ADA recommendation
      },
      period: {
        start: startDate || null,
        end: endDate || null,
        days: periodDays
      },
      treatments_count: treatments?.length || 0,
      expenses_count: expenses?.length || 0,
      // Metadata for debugging/transparency
      metadata: {
        monthly_configured_fixed_cents: monthlyConfiguredFixedCents,
        monthly_depreciation_cents: monthlyDepreciationCents,
        proration_factor: periodDays / daysInMonth,
        explanation: 'Real profit = Revenue - Registered Expenses. Theoretical = Revenue - Variable - Configured Fixed - Depreciation.'
      }
    })

  } catch (error) {
    console.error('Error in GET /api/analytics/profit-analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
