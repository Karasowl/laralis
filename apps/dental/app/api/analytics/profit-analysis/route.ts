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
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import {
  collectedRevenueCents,
  completedBilledRevenueCents,
  prorateMonthlyAmountForRange,
} from '@/lib/calc/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Convex read branch: replicates the EXACT Supabase aggregation in JS.
 *
 * Mirrors:
 * - treatments: status === 'completed', treatment_date filtered with the SAME
 *   lexicographic >= startDate / <= endDate guards (each applied only when present),
 *   summing price_cents (revenue) and variable_cost_cents.
 * - expenses: expense_date filtered with the SAME guards, summing amount_cents.
 * - fixed_costs: all rows for the clinic, summing amount_cents.
 * - assets: monthly depreciation = round(purchase_price_cents / depreciation_months).
 *
 * Returns the SAME response shape (keys, nesting, units, rounding) as the Supabase path.
 */
async function getProfitAnalysisFromConvex(
  clinicId: string,
  startDate: string | null,
  endDate: string | null,
  periodDays: number,
  daysInMonth: number
) {
  const [treatmentsRaw, expensesRaw, fixedCostsRaw, assetsRaw] = await Promise.all([
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('expenses', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('fixed_costs', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('assets', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  // ===== 1 & 2. Completed treatments within the date range =====
  // status === 'completed' AND (no startDate OR treatment_date >= startDate)
  //                          AND (no endDate   OR treatment_date <= endDate)
  // Lexicographic comparison is safe on YYYY-MM-DD strings, matching Supabase .gte/.lte.
  const treatments = treatmentsRaw
    .map(normalizeConvexRecord)
    .filter((t) => {
      if (t.status !== 'completed') return false
      const treatmentDate = String(t.treatment_date || '')
      if (startDate && treatmentDate < startDate) return false
      if (endDate && treatmentDate > endDate) return false
      return true
    })

  const revenueCents = treatments.reduce((sum, t) => sum + collectedRevenueCents(t), 0)
  const billedRevenueCents = treatments.reduce((sum, t) => sum + completedBilledRevenueCents(t), 0)

  const variableCostsCents = treatments.reduce(
    (sum, t) => sum + (t.variable_cost_cents || 0),
    0
  )

  // ===== 3. Expenses within the date range =====
  const expenses = expensesRaw
    .map(normalizeConvexRecord)
    .filter((e) => {
      const expenseDate = String(e.expense_date || '')
      if (startDate && expenseDate < startDate) return false
      if (endDate && expenseDate > endDate) return false
      return true
    })

  const fixedCostsRealCents = expenses.reduce(
    (sum, e) => sum + (e.amount_cents || 0),
    0
  )

  // ===== 4. Configured fixed costs (all rows for the clinic) =====
  const monthlyConfiguredFixedCents = fixedCostsRaw.reduce(
    (sum, fc) => sum + (fc.amount_cents || 0),
    0
  )

  const fixedCostsConfiguredCents = startDate && endDate
    ? prorateMonthlyAmountForRange(monthlyConfiguredFixedCents, startDate, endDate)
    : monthlyConfiguredFixedCents

  // ===== 5. Asset depreciation (all rows for the clinic) =====
  const monthlyDepreciationCents = assetsRaw.reduce((sum, asset) => {
    const months = asset.depreciation_months || 1
    const monthlyDepreciation = Math.round((asset.purchase_price_cents || 0) / months)
    return sum + monthlyDepreciation
  }, 0)

  const depreciationCents = startDate && endDate
    ? prorateMonthlyAmountForRange(monthlyDepreciationCents, startDate, endDate)
    : monthlyDepreciationCents

  return buildProfitResponse({
    revenueCents,
    billedRevenueCents,
    variableCostsCents,
    fixedCostsRealCents,
    fixedCostsConfiguredCents,
    depreciationCents,
    monthlyConfiguredFixedCents,
    monthlyDepreciationCents,
    treatmentsCount: treatments.length,
    expensesCount: expenses.length,
    startDate,
    endDate,
    periodDays,
    daysInMonth,
  })
}

/**
 * Builds the response body from pre-aggregated cents totals.
 * Shared by the Supabase and Convex branches to guarantee byte-identical shape,
 * rounding, and field names.
 */
function buildProfitResponse(input: {
  revenueCents: number
  billedRevenueCents: number
  variableCostsCents: number
  fixedCostsRealCents: number
  fixedCostsConfiguredCents: number
  depreciationCents: number
  monthlyConfiguredFixedCents: number
  monthlyDepreciationCents: number
  treatmentsCount: number
  expensesCount: number
  startDate: string | null
  endDate: string | null
  periodDays: number
  daysInMonth: number
}) {
  const {
    revenueCents,
    billedRevenueCents,
    variableCostsCents,
    fixedCostsRealCents,
    fixedCostsConfiguredCents,
    depreciationCents,
    monthlyConfiguredFixedCents,
    monthlyDepreciationCents,
    treatmentsCount,
    expensesCount,
    startDate,
    endDate,
    periodDays,
    daysInMonth,
  } = input

  const realProfitCents = revenueCents - fixedCostsRealCents
  const realMarginPct = revenueCents > 0
    ? (realProfitCents / revenueCents) * 100
    : 0

  const theoreticalCostsCents = variableCostsCents + fixedCostsConfiguredCents + depreciationCents
  const theoreticalProfitCents = billedRevenueCents - theoreticalCostsCents
  const theoreticalMarginPct = billedRevenueCents > 0
    ? (theoreticalProfitCents / billedRevenueCents) * 100
    : 0

  const differenceCents = realProfitCents - theoreticalProfitCents

  const grossProfitCents = billedRevenueCents - variableCostsCents
  const grossMarginPct = billedRevenueCents > 0
    ? (grossProfitCents / billedRevenueCents) * 100
    : 0

  const netProfitCents = realProfitCents
  const netMarginPct = realMarginPct

  const totalCostsCents = fixedCostsRealCents

  return NextResponse.json({
    revenue_cents: revenueCents,
    billed_revenue_cents: billedRevenueCents,
    accounts_receivable_cents: Math.max(0, billedRevenueCents - revenueCents),
    costs: {
      expenses_cents: fixedCostsRealCents,
      variable_cents: variableCostsCents,
      configured_fixed_cents: fixedCostsConfiguredCents,
      depreciation_cents: depreciationCents,
      total_cents: totalCostsCents
    },
    profits: {
      real_profit_cents: realProfitCents,
      real_margin_pct: Math.round(realMarginPct * 10) / 10,
      theoretical_profit_cents: theoreticalProfitCents,
      theoretical_margin_pct: Math.round(theoreticalMarginPct * 10) / 10,
      difference_cents: differenceCents,
      gross_profit_cents: grossProfitCents,
      gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
      net_profit_cents: netProfitCents,
      net_margin_pct: Math.round(netMarginPct * 10) / 10
    },
    benchmarks: {
      gross_margin_target_pct: 85,
      operating_margin_target_pct: 20,
      ebitda_margin_target_pct: 17.5,
      overhead_ratio_target_pct: 63
    },
    period: {
      start: startDate || null,
      end: endDate || null,
      days: periodDays
    },
    treatments_count: treatmentsCount,
    expenses_count: expensesCount,
    metadata: {
      monthly_configured_fixed_cents: monthlyConfiguredFixedCents,
      monthly_depreciation_cents: monthlyDepreciationCents,
      proration_factor: monthlyConfiguredFixedCents > 0 ? fixedCostsConfiguredCents / monthlyConfiguredFixedCents : 0,
      explanation: 'Real profit = collected revenue - registered expenses. Gross and theoretical profit use completed billed revenue.'
    }
  })
}

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

export const GET = withPermission('financial_reports.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const clinicId = context.clinicId

    // Calculate period days for prorating monthly costs
    const { periodDays, daysInMonth } = calculatePeriodInfo(startDate, endDate)

    // Convex read branch (flag-gated). Returns the SAME response shape with
    // identical numeric aggregation. Production is unaffected until the flag flips.
    if (shouldReturnConvexData('treatments')) {
      return await getProfitAnalysisFromConvex(clinicId, startDate, endDate, periodDays, daysInMonth)
    }

    // ===== 1. Get Revenue from completed treatments =====
    // Include variable_cost_cents for accurate gross profit calculation
    let treatmentsQuery = supabaseAdmin
      .from('treatments')
      .select('price_cents, amount_paid_cents, is_paid, status, variable_cost_cents')
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

    const revenueCents = treatments?.reduce((sum, t) => sum + collectedRevenueCents(t), 0) || 0
    const billedRevenueCents = treatments?.reduce((sum, t) => sum + completedBilledRevenueCents(t), 0) || 0

    // ===== 2. Get Variable Costs from treatments (materials/supplies used) =====
    // IMPORTANT: Variable costs come from treatments.variable_cost_cents, NOT from expenses
    // This field is a snapshot of material costs at the time of treatment
    const variableCostsCents = treatments?.reduce(
      (sum, t) => sum + (t.variable_cost_cents || 0),
      0
    ) || 0

    // ===== 3. Get Expenses (for real fixed costs tracking) =====
    let expensesQuery = supabaseAdmin
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
    const { data: configuredFixedCosts, error: fixedCostsError } = await supabaseAdmin
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
    const fixedCostsConfiguredCents = startDate && endDate
      ? prorateMonthlyAmountForRange(monthlyConfiguredFixedCents, startDate, endDate)
      : monthlyConfiguredFixedCents

    // ===== 5. Get Assets for depreciation calculation =====
    const { data: assets, error: assetsError } = await supabaseAdmin
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
    const depreciationCents = startDate && endDate
      ? prorateMonthlyAmountForRange(monthlyDepreciationCents, startDate, endDate)
      : monthlyDepreciationCents

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
    const theoreticalProfitCents = billedRevenueCents - theoreticalCostsCents
    const theoreticalMarginPct = billedRevenueCents > 0
      ? (theoreticalProfitCents / billedRevenueCents) * 100
      : 0

    // Difference shows if you're spending more or less than expected
    const differenceCents = realProfitCents - theoreticalProfitCents

    // Legacy metrics kept for backward compatibility
    const grossProfitCents = billedRevenueCents - variableCostsCents
    const grossMarginPct = billedRevenueCents > 0
      ? (grossProfitCents / billedRevenueCents) * 100
      : 0

    // Use real profit as the "net profit" (what actually matters)
    const netProfitCents = realProfitCents
    const netMarginPct = realMarginPct

    // Total costs based on registered expenses
    const totalCostsCents = fixedCostsRealCents

    // ===== 7. Return Response =====
    return NextResponse.json({
      revenue_cents: revenueCents,
      billed_revenue_cents: billedRevenueCents,
      accounts_receivable_cents: Math.max(0, billedRevenueCents - revenueCents),
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
        proration_factor: monthlyConfiguredFixedCents > 0 ? fixedCostsConfiguredCents / monthlyConfiguredFixedCents : 0,
        explanation: 'Real profit = collected revenue - registered expenses. Gross and theoretical profit use completed billed revenue.'
      }
    })

  } catch (error) {
    console.error('Error in GET /api/analytics/profit-analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
