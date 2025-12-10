/**
 * Analytics: Profit Analysis
 *
 * GET /api/analytics/profit-analysis
 * Returns comprehensive profit metrics: Gross Profit, Operating Profit, EBITDA, Net Profit
 *
 * This endpoint calculates profit metrics using:
 * - Revenue from completed treatments
 * - Variable costs from expenses table (WHERE is_variable = true)
 * - Fixed costs from BOTH:
 *   - fixed_costs table (configured monthly costs, prorated to period)
 *   - expenses table (WHERE is_variable = false) - actual recorded expenses
 * - Depreciation calculated from assets (prorated to period)
 *
 * Formulas:
 * - Gross Profit = Revenue - Variable Costs
 * - Operating Profit (EBIT) = Gross Profit - Fixed Costs (configured, prorated)
 * - EBITDA = Operating Profit + Depreciation (prorated)
 * - Net Profit = Operating Profit (simplified, no taxes/interest yet)
 *
 * NOTE: EBITDA should never exceed Revenue. If it does, there's a calculation error.
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
    // Use CONFIGURED fixed costs for profitability calculations
    // This gives a realistic view of the clinic's financial health

    // Gross Profit = Revenue - Variable Costs (materials, lab fees)
    const grossProfitCents = revenueCents - variableCostsCents
    const grossMarginPct = revenueCents > 0
      ? (grossProfitCents / revenueCents) * 100
      : 0

    // Operating Profit (EBIT) = Gross Profit - Fixed Costs (CONFIGURED, prorated)
    const operatingProfitCents = grossProfitCents - fixedCostsConfiguredCents
    const operatingMarginPct = revenueCents > 0
      ? (operatingProfitCents / revenueCents) * 100
      : 0

    // EBITDA = Operating Profit + Depreciation
    // Note: This adds back depreciation (a non-cash expense) to operating profit
    const ebitdaCents = operatingProfitCents + depreciationCents
    const ebitdaMarginPct = revenueCents > 0
      ? (ebitdaCents / revenueCents) * 100
      : 0

    // Net Profit = Operating Profit (simplified - same as EBIT since we already deducted depreciation)
    // In a full accounting system, this would also subtract taxes and interest
    const netProfitCents = operatingProfitCents
    const netMarginPct = revenueCents > 0
      ? (netProfitCents / revenueCents) * 100
      : 0

    // Total costs for reference (using configured fixed costs)
    const totalCostsCents = variableCostsCents + fixedCostsConfiguredCents + depreciationCents

    // ===== 7. Return Response =====
    return NextResponse.json({
      revenue_cents: revenueCents,
      costs: {
        variable_cents: variableCostsCents,
        // BREAKING CHANGE: Now returns both real and configured fixed costs
        fixed_cents: fixedCostsConfiguredCents,        // Used in calculations (prorated from fixed_costs table)
        fixed_cents_real: fixedCostsRealCents,         // Actual expenses recorded (from expenses table)
        fixed_cents_configured: fixedCostsConfiguredCents, // Configured monthly costs (prorated)
        depreciation_cents: depreciationCents,
        total_cents: totalCostsCents
      },
      profits: {
        gross_profit_cents: grossProfitCents,
        gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
        operating_profit_cents: operatingProfitCents,
        operating_margin_pct: Math.round(operatingMarginPct * 10) / 10,
        ebitda_cents: ebitdaCents,
        ebitda_margin_pct: Math.round(ebitdaMarginPct * 10) / 10,
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
        variable_costs_source: 'treatments.variable_cost_cents (materials snapshot)',
        fixed_costs_source: 'fixed_costs table (configured) + assets (depreciation)'
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
