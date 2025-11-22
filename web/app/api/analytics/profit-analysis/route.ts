/**
 * Analytics: Profit Analysis
 *
 * GET /api/analytics/profit-analysis
 * Returns comprehensive profit metrics: Gross Profit, Operating Profit, EBITDA, Net Profit
 *
 * This endpoint calculates profit metrics correctly using:
 * - Variable costs from expenses table (WHERE is_variable = true)
 * - Fixed costs from expenses table (WHERE is_variable = false)
 * - Depreciation calculated from assets
 *
 * Formulas:
 * - Gross Profit = Revenue - Variable Costs
 * - Operating Profit (EBIT) = Gross Profit - Fixed Costs
 * - EBITDA = Operating Profit + Depreciation
 * - Net Profit = EBITDA - Depreciation (simplified, no taxes/interest yet)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

    // ===== 1. Get Revenue from completed treatments =====
    let treatmentsQuery = supabase
      .from('treatments')
      .select('price_cents')
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

    // ===== 2. Get Expenses (variable and fixed) =====
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

    const variableCostsCents = expenses?.reduce(
      (sum, e) => sum + (e.is_variable ? (e.amount_cents || 0) : 0),
      0
    ) || 0

    const fixedCostsCents = expenses?.reduce(
      (sum, e) => sum + (!e.is_variable ? (e.amount_cents || 0) : 0),
      0
    ) || 0

    // ===== 3. Get Assets for depreciation calculation =====
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('purchase_price_cents, depreciation_months, purchase_date')
      .eq('clinic_id', clinicId)

    if (assetsError) {
      throw assetsError
    }

    // Calculate depreciation for the period
    // Monthly depreciation = purchase_price / depreciation_months
    const depreciationCents = assets?.reduce((sum, asset) => {
      const months = asset.depreciation_months || 1
      const monthlyDepreciation = Math.round((asset.purchase_price_cents || 0) / months)

      // TODO: If we want to be more precise, we could calculate depreciation
      // only for the months the asset has been owned within the period.
      // For now, we'll use full monthly depreciation.

      return sum + monthlyDepreciation
    }, 0) || 0

    // ===== 4. Calculate Profit Metrics =====

    // Gross Profit = Revenue - Variable Costs (materials, lab fees)
    const grossProfitCents = revenueCents - variableCostsCents
    const grossMarginPct = revenueCents > 0
      ? (grossProfitCents / revenueCents) * 100
      : 0

    // Operating Profit (EBIT) = Gross Profit - Fixed Costs
    const operatingProfitCents = grossProfitCents - fixedCostsCents
    const operatingMarginPct = revenueCents > 0
      ? (operatingProfitCents / revenueCents) * 100
      : 0

    // EBITDA = Operating Profit + Depreciation
    const ebitdaCents = operatingProfitCents + depreciationCents
    const ebitdaMarginPct = revenueCents > 0
      ? (ebitdaCents / revenueCents) * 100
      : 0

    // Net Profit = EBITDA - Depreciation (simplified, no taxes/interest)
    const netProfitCents = ebitdaCents - depreciationCents
    const netMarginPct = revenueCents > 0
      ? (netProfitCents / revenueCents) * 100
      : 0

    // Total costs for reference
    const totalCostsCents = variableCostsCents + fixedCostsCents + depreciationCents

    // ===== 5. Return Response =====
    return NextResponse.json({
      revenue_cents: revenueCents,
      costs: {
        variable_cents: variableCostsCents,
        fixed_cents: fixedCostsCents,
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
      },
      treatments_count: treatments?.length || 0,
      expenses_count: expenses?.length || 0
    })

  } catch (error) {
    console.error('Error in GET /api/analytics/profit-analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
