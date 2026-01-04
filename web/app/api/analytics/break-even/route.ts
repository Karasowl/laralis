/**
 * Analytics: Break-Even Analysis
 *
 * GET /api/analytics/break-even
 * Calculates break-even point and profitability metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withPermission('break_even.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const clinicId = context.clinicId

    // Get revenue from treatments
    let treatmentsQuery = supabaseAdmin
      .from('treatments')
      .select('price_cents, variable_cost_cents, fixed_cost_per_minute_cents, minutes')
      .eq('clinic_id', clinicId)

    if (startDate) treatmentsQuery = treatmentsQuery.gte('treatment_date', startDate)
    if (endDate) treatmentsQuery = treatmentsQuery.lte('treatment_date', endDate)

    const { data: treatments, error: treatmentsError } = await treatmentsQuery
    if (treatmentsError) throw treatmentsError

    // Get fixed costs
    const { data: fixedCosts, error: fixedCostsError } = await supabaseAdmin
      .from('fixed_costs')
      .select('amount_cents, frequency')
      .eq('clinic_id', clinicId)

    if (fixedCostsError) throw fixedCostsError

    // Calculate totals
    const totalRevenue = treatments?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0

    const totalVariableCosts =
      treatments?.reduce((sum, t) => sum + (t.variable_cost_cents || 0), 0) || 0

    const totalFixedCosts =
      fixedCosts?.reduce((sum, fc) => {
        const monthlyCost = fc.amount_cents || 0
        // Simple conversion: assume all frequencies are monthly for now
        return sum + monthlyCost
      }, 0) || 0

    const totalCosts = totalVariableCosts + totalFixedCosts
    const profit = totalRevenue - totalCosts

    // Calculate contribution margin
    const contributionMargin = totalRevenue - totalVariableCosts
    const contributionMarginRatio =
      totalRevenue > 0 ? (contributionMargin / totalRevenue) * 100 : 0

    // Calculate break-even point (in revenue)
    const breakEvenRevenue =
      contributionMarginRatio > 0 ? totalFixedCosts / (contributionMarginRatio / 100) : 0

    // Calculate how many treatments needed for break-even
    const avgRevenuePerTreatment =
      treatments && treatments.length > 0 ? totalRevenue / treatments.length : 0

    const breakEvenTreatments =
      avgRevenuePerTreatment > 0 ? Math.ceil(breakEvenRevenue / avgRevenuePerTreatment) : 0

    // Calculate profitability ratio
    const profitabilityRatio = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

    return NextResponse.json({
      revenue_cents: totalRevenue,
      fixed_costs_cents: totalFixedCosts,
      variable_costs_cents: totalVariableCosts,
      total_costs_cents: totalCosts,
      profit_cents: profit,
      contribution_margin_cents: contributionMargin,
      contribution_margin_ratio: Math.round(contributionMarginRatio * 10) / 10,
      profitability_ratio: Math.round(profitabilityRatio * 10) / 10,
      break_even_revenue_cents: Math.round(breakEvenRevenue),
      break_even_treatments: breakEvenTreatments,
      current_treatments: treatments?.length || 0,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
    })
  } catch (error) {
    console.error('[API /analytics/break-even] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate break-even',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
