/**
 * Analytics Actions for Lara AI
 *
 * Read-only analytics actions that query and analyze clinic data.
 * These actions don't modify data, they only return insights.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionParams, ActionResult } from '../types'
import { listConvexDocumentsByClinic, decodeConvexValue } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { calculatePercentageChange, collectedRevenueCents } from '@/lib/calc/metrics'

interface ActionContext {
  supabase: SupabaseClient
  clinicId: string
  userId: string
  dryRun?: boolean
}

// Helper to get date N days ago
function getDateDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// Helper to format cents as currency string
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Convex bookkeeping fields stripped from rows so they mirror the Supabase shape.
const CONVEX_META_FIELDS = ['_id', '_creationTime', 'legacyId', 'legacyTable', 'convex_created_at', 'convex_updated_at', 'convex_snapshot_source']
function stripConvexRow(row: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    if (CONVEX_META_FIELDS.includes(k)) continue
    clean[k] = v
  }
  return decodeConvexValue(clean) as Record<string, any>
}

/**
 * Read every row of a clinic-scoped table from Convex (convex-only mode), stripped
 * to the Supabase shape. Domain string per table keeps flag-gating consistent.
 */
async function listClinicTableFromConvex(table: string, clinicId: string): Promise<Record<string, any>[]> {
  const rows = (await listConvexDocumentsByClinic(table, clinicId)) as Record<string, any>[]
  return rows.map((r) => stripConvexRow(r))
}

/**
 * True when a row's timestamp column falls within an inclusive [start, end] window.
 * Mirrors the Supabase `.gte(col, start).lte(col, end)` ISO-string comparison.
 */
function withinRange(value: unknown, startIso?: string, endIso?: string): boolean {
  if (value == null) return false
  const v = String(value)
  if (startIso !== undefined && v < startIso) return false
  if (endIso !== undefined && v > endIso) return false
  return true
}

/**
 * Get break-even analysis
 */
export async function executeGetBreakEvenAnalysis(
  params: ActionParams['get_break_even_analysis'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const periodDays = params.period_days || 30
  const startDate = getDateDaysAgo(periodDays)

  try {
    let fixedCostsData: Record<string, any>[]
    let assetsData: Record<string, any>[]
    let treatments: Record<string, any>[]
    let services: Record<string, any>[]

    if (shouldReturnConvexData('analytics')) {
      const startIso = startDate.toISOString()
      const [fixedCostsRows, assetsRows, treatmentRows, serviceRows] = await Promise.all([
        listClinicTableFromConvex('fixed_costs', clinicId),
        listClinicTableFromConvex('assets', clinicId),
        listClinicTableFromConvex('treatments', clinicId),
        listClinicTableFromConvex('services', clinicId),
      ])
      fixedCostsData = fixedCostsRows
      assetsData = assetsRows
      treatments = treatmentRows.filter((t) => withinRange(t.treatment_date, startIso))
      services = serviceRows
    } else {
      // Get fixed costs (manual + asset depreciation)
      const [fixedCostsResult, assetsResult, treatmentsResult, servicesResult] = await Promise.all([
        supabase.from('fixed_costs').select('amount_cents').eq('clinic_id', clinicId),
        supabase.from('assets').select('acquisition_cost_cents, useful_life_years').eq('clinic_id', clinicId),
        supabase
          .from('treatments')
          .select('price_cents, service_id')
          .eq('clinic_id', clinicId)
          .gte('treatment_date', startDate.toISOString()),
        supabase.from('services').select('id, name, price_cents, variable_cost_cents').eq('clinic_id', clinicId),
      ])
      fixedCostsData = fixedCostsResult.data || []
      assetsData = assetsResult.data || []
      treatments = treatmentsResult.data || []
      services = servicesResult.data || []
    }

    // Calculate total fixed costs
    const manualFixedCosts = fixedCostsData.reduce((sum, fc) => sum + (fc.amount_cents || 0), 0) || 0
    const assetDepreciation =
      assetsData.reduce((sum, asset) => {
        const monthlyDep = Math.round((asset.acquisition_cost_cents || 0) / ((asset.useful_life_years || 1) * 12))
        return sum + monthlyDep
      }, 0) || 0
    const totalFixedCosts = manualFixedCosts + assetDepreciation

    // Calculate revenue and variable costs
    const serviceMap = new Map(services.map(s => [s.id, s]))

    let totalRevenue = 0
    let totalVariableCosts = 0

    treatments.forEach(t => {
      totalRevenue += t.price_cents || 0
      const service = serviceMap.get(t.service_id)
      if (service) {
        totalVariableCosts += service.variable_cost_cents || 0
      }
    })

    // Calculate metrics
    const contributionMargin = totalRevenue > 0 ? ((totalRevenue - totalVariableCosts) / totalRevenue) * 100 : 0
    const breakEvenRevenue = contributionMargin > 0 ? Math.round(totalFixedCosts / (contributionMargin / 100)) : 0
    const avgTreatmentPrice = treatments.length > 0 ? Math.round(totalRevenue / treatments.length) : 0
    const breakEvenTreatments = avgTreatmentPrice > 0 ? Math.ceil(breakEvenRevenue / avgTreatmentPrice) : 0

    const gap = treatments.length - breakEvenTreatments
    const status = gap > 0 ? 'above' : gap < 0 ? 'below' : 'at'

    return {
      success: true,
      action: 'get_break_even_analysis',
      params,
      result: {
        changes: [
          `📊 Break-Even Analysis (${periodDays} days)`,
          '',
          `**Fixed Costs:** ${formatCurrency(totalFixedCosts)}/month`,
          `  - Manual costs: ${formatCurrency(manualFixedCosts)}`,
          `  - Asset depreciation: ${formatCurrency(assetDepreciation)}`,
          '',
          `**Revenue:** ${formatCurrency(totalRevenue)}`,
          `**Variable Costs:** ${formatCurrency(totalVariableCosts)}`,
          `**Contribution Margin:** ${contributionMargin.toFixed(1)}%`,
          '',
          `**Break-Even Point:**`,
          `  - Revenue needed: ${formatCurrency(breakEvenRevenue)}`,
          `  - Treatments needed: ${breakEvenTreatments}`,
          '',
          `**Current Status:** ${status === 'above' ? '✅ ABOVE' : status === 'below' ? '⚠️ BELOW' : '➖ AT'} break-even`,
          `  - Current treatments: ${treatments.length}`,
          `  - Gap: ${gap > 0 ? '+' : ''}${gap} treatments`,
        ],
        break_even: {
          fixed_costs_cents: totalFixedCosts,
          revenue_cents: totalRevenue,
          variable_costs_cents: totalVariableCosts,
          contribution_margin_pct: contributionMargin,
          break_even_revenue_cents: breakEvenRevenue,
          break_even_treatments: breakEvenTreatments,
          current_treatments: treatments.length,
          gap,
          status,
        },
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'get_break_even_analysis',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Get top services
 */
export async function executeGetTopServices(
  params: ActionParams['get_top_services'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const limit = params.limit || 5
  const sortBy = params.sort_by || 'revenue'
  const periodDays = params.period_days || 30
  const startDate = getDateDaysAgo(periodDays)

  try {
    let treatments: Record<string, any>[]
    let services: Record<string, any>[]

    if (shouldReturnConvexData('analytics')) {
      const startIso = startDate.toISOString()
      const [treatmentRows, serviceRows] = await Promise.all([
        listClinicTableFromConvex('treatments', clinicId),
        listClinicTableFromConvex('services', clinicId),
      ])
      treatments = treatmentRows.filter((t) => withinRange(t.treatment_date, startIso))
      services = serviceRows
    } else {
      const [treatmentsResult, servicesResult] = await Promise.all([
        supabase
          .from('treatments')
          .select('price_cents, service_id')
          .eq('clinic_id', clinicId)
          .gte('treatment_date', startDate.toISOString()),
        supabase
          .from('services')
          .select('id, name, price_cents, variable_cost_cents, fixed_cost_cents')
          .eq('clinic_id', clinicId),
      ])
      treatments = treatmentsResult.data || []
      services = servicesResult.data || []
    }

    // Aggregate by service
    const serviceStats = new Map<string, { name: string; revenue: number; count: number; margin: number | null }>()

    services.forEach(s => {
      serviceStats.set(s.id, {
        name: s.name,
        revenue: 0,
        count: 0,
        margin: null,
      })
    })

    treatments.forEach(t => {
      const stats = serviceStats.get(t.service_id)
      if (stats) {
        stats.revenue += t.price_cents || 0
        stats.count++
      }
    })

    // Calculate margins
    services.forEach(s => {
      const stats = serviceStats.get(s.id)
      if (stats && stats.count > 0) {
        const totalCost = (s.variable_cost_cents || 0) + (s.fixed_cost_cents || 0)
        const price = s.price_cents || 0
        stats.margin = totalCost > 0 ? ((price - totalCost) / totalCost) * 100 : null
      }
    })

    // Sort and limit
    const sortedServices = Array.from(serviceStats.values())
      .filter(s => s.count > 0)
      .sort((a, b) => {
        if (sortBy === 'revenue') return b.revenue - a.revenue
        if (sortBy === 'count') return b.count - a.count
        return (b.margin ?? Number.NEGATIVE_INFINITY) - (a.margin ?? Number.NEGATIVE_INFINITY)
      })
      .slice(0, limit)

    const changes = [
      `🏆 Top ${limit} Services by ${sortBy === 'revenue' ? 'Revenue' : sortBy === 'count' ? 'Count' : 'Markup on cost'} (${periodDays} days)`,
      '',
    ]

    sortedServices.forEach((s, i) => {
      changes.push(
        `${i + 1}. **${s.name}**`,
        `   Revenue: ${formatCurrency(s.revenue)} | Count: ${s.count} | Markup on cost: ${s.margin === null ? 'no cost basis' : `${s.margin.toFixed(0)}%`}`
      )
    })

    return {
      success: true,
      action: 'get_top_services',
      params,
      result: {
        changes,
        top_services: sortedServices,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'get_top_services',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Get expense breakdown
 */
export async function executeGetExpenseBreakdown(
  params: ActionParams['get_expense_breakdown'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const periodDays = params.period_days || 30
  const groupBy = params.group_by || 'category'
  const startDate = getDateDaysAgo(periodDays)

  try {
    let expenses: Record<string, any>[]

    if (shouldReturnConvexData('analytics')) {
      const startIso = startDate.toISOString()
      const rows = await listClinicTableFromConvex('expenses', clinicId)
      expenses = rows.filter((e) => withinRange(e.expense_date, startIso))
    } else {
      const { data } = await supabase
        .from('expenses')
        .select('amount_cents, category, subcategory, vendor')
        .eq('clinic_id', clinicId)
        .gte('expense_date', startDate.toISOString())
      expenses = data || []
    }

    if (!expenses || expenses.length === 0) {
      return {
        success: true,
        action: 'get_expense_breakdown',
        params,
        result: {
          changes: [`📊 No expenses found in the last ${periodDays} days`],
          breakdown: [],
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Group expenses
    const groups = new Map<string, number>()
    let total = 0

    expenses.forEach(e => {
      const key = e[groupBy] || 'Other'
      groups.set(key, (groups.get(key) || 0) + (e.amount_cents || 0))
      total += e.amount_cents || 0
    })

    // Sort by amount
    const sorted = Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        amount_cents: amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))

    const changes = [`💰 Expense Breakdown by ${groupBy} (${periodDays} days)`, '', `**Total:** ${formatCurrency(total)}`, '']

    sorted.forEach(g => {
      const bar = '█'.repeat(Math.round(g.percentage / 5))
      changes.push(`${g.name}: ${formatCurrency(g.amount_cents)} (${g.percentage.toFixed(1)}%)`, `${bar}`)
    })

    return {
      success: true,
      action: 'get_expense_breakdown',
      params,
      result: {
        changes,
        breakdown: sorted,
        total_cents: total,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'get_expense_breakdown',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Get service profitability
 */
export async function executeGetServiceProfitability(
  params: ActionParams['get_service_profitability'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const periodDays = params.period_days || 30
  const sortBy = params.sort_by || 'margin'
  const startDate = getDateDaysAgo(periodDays)

  try {
    let services: Record<string, any>[]
    let treatments: Record<string, any>[]

    if (shouldReturnConvexData('analytics')) {
      const startIso = startDate.toISOString()
      const [serviceRows, treatmentRows] = await Promise.all([
        listClinicTableFromConvex('services', clinicId),
        listClinicTableFromConvex('treatments', clinicId),
      ])
      services = params.service_id
        ? serviceRows.filter((s) => String(s.id) === String(params.service_id))
        : serviceRows
      treatments = treatmentRows.filter((t) => withinRange(t.treatment_date, startIso))
    } else {
      let servicesQuery = supabase
        .from('services')
        .select('id, name, price_cents, variable_cost_cents, fixed_cost_cents')
        .eq('clinic_id', clinicId)

      if (params.service_id) {
        servicesQuery = servicesQuery.eq('id', params.service_id)
      }

      const [servicesResult, treatmentsResult] = await Promise.all([
        servicesQuery,
        supabase
          .from('treatments')
          .select('price_cents, service_id')
          .eq('clinic_id', clinicId)
          .gte('treatment_date', startDate.toISOString()),
      ])

      services = servicesResult.data || []
      treatments = treatmentsResult.data || []
    }

    // Calculate profitability for each service
    const profitability = services.map(s => {
      const serviceTreatments = treatments.filter(t => t.service_id === s.id)
      const count = serviceTreatments.length
      const revenue = serviceTreatments.reduce((sum, t) => sum + (t.price_cents || 0), 0)
      const totalCost = (s.variable_cost_cents || 0) + (s.fixed_cost_cents || 0)
      const profit = s.price_cents - totalCost
      const margin = totalCost > 0 ? (profit / totalCost) * 100 : null

      return {
        id: s.id,
        name: s.name,
        price_cents: s.price_cents,
        cost_cents: totalCost,
        profit_cents: profit,
        margin_pct: margin,
        count,
        total_revenue_cents: revenue,
        total_profit_cents: profit * count,
      }
    })

    // Sort
    const sorted = profitability.sort((a, b) => {
      if (sortBy === 'margin') return (b.margin_pct ?? Number.NEGATIVE_INFINITY) - (a.margin_pct ?? Number.NEGATIVE_INFINITY)
      if (sortBy === 'revenue') return b.total_revenue_cents - a.total_revenue_cents
      return b.count - a.count
    })

    const changes = [`📈 Service Profitability (${periodDays} days)`, '']

    sorted.forEach(s => {
      const marginIcon = s.margin_pct === null ? 'ℹ️' : s.margin_pct >= 50 ? '🟢' : s.margin_pct >= 30 ? '🟡' : '🔴'
      changes.push(
        `**${s.name}** ${marginIcon}`,
        `  Price: ${formatCurrency(s.price_cents)} | Cost: ${formatCurrency(s.cost_cents)} | Markup on cost: ${s.margin_pct === null ? 'no cost basis' : `${s.margin_pct.toFixed(0)}%`}`,
        `  Count: ${s.count} | Revenue: ${formatCurrency(s.total_revenue_cents)} | Profit: ${formatCurrency(s.total_profit_cents)}`,
        ''
      )
    })

    return {
      success: true,
      action: 'get_service_profitability',
      params,
      result: {
        changes,
        services: sorted,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'get_service_profitability',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Identify underperforming services
 */
export async function executeIdentifyUnderperformingServices(
  params: ActionParams['identify_underperforming_services'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const minMargin = params.min_margin_pct || 30
  const includeSuggestions = params.include_suggestions !== false

  try {
    let services: Record<string, any>[]

    if (shouldReturnConvexData('analytics')) {
      services = await listClinicTableFromConvex('services', clinicId)
    } else {
      const { data } = await supabase
        .from('services')
        .select('id, name, price_cents, variable_cost_cents, fixed_cost_cents')
        .eq('clinic_id', clinicId)
      services = data || []
    }

    if (!services || services.length === 0) {
      return {
        success: true,
        action: 'identify_underperforming_services',
        params,
        result: { changes: ['No services found'], underperforming: [] },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    const underperforming = services
      .map(s => {
        const totalCost = (s.variable_cost_cents || 0) + (s.fixed_cost_cents || 0)
        const profit = s.price_cents - totalCost
        const margin = totalCost > 0 ? (profit / totalCost) * 100 : null
        const suggestedPrice = totalCost > 0 ? Math.round(totalCost * (1 + minMargin / 100)) : s.price_cents

        return {
          id: s.id,
          name: s.name,
          price_cents: s.price_cents,
          cost_cents: totalCost,
          margin_pct: margin,
          suggested_price_cents: suggestedPrice,
          price_increase_needed: suggestedPrice - s.price_cents,
        }
      })
      .filter((service): service is typeof service & { margin_pct: number } => service.margin_pct !== null && service.margin_pct < minMargin)
      .sort((a, b) => a.margin_pct - b.margin_pct)

    const changes = [`⚠️ Services with markup below ${minMargin}%`, '']

    if (underperforming.length === 0) {
      changes.push(`✅ All services with a cost basis have markup above ${minMargin}%!`)
    } else {
      underperforming.forEach(s => {
        changes.push(
          `**${s.name}** - Markup on cost: ${s.margin_pct.toFixed(0)}%`,
          `  Current: ${formatCurrency(s.price_cents)} | Cost: ${formatCurrency(s.cost_cents)}`
        )
        if (includeSuggestions && s.price_increase_needed > 0) {
          changes.push(
            `  💡 Suggested price: ${formatCurrency(s.suggested_price_cents)} (+${formatCurrency(s.price_increase_needed)})`
          )
        }
        changes.push('')
      })
    }

    return {
      success: true,
      action: 'identify_underperforming_services',
      params,
      result: {
        changes,
        underperforming,
        total_underperforming: underperforming.length,
        total_services: services.length,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'identify_underperforming_services',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Compare periods
 */
export async function executeComparePeriods(
  params: ActionParams['compare_periods'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const { period1_start, period1_end, period2_start, period2_end, metrics = ['revenue', 'expenses', 'treatments', 'patients'] } = params

  try {
    // Query data for both periods
    let treatments1Data: Record<string, any>[]
    let treatments2Data: Record<string, any>[]
    let expenses1Data: Record<string, any>[]
    let expenses2Data: Record<string, any>[]
    let patients1Data: Record<string, any>[]
    let patients2Data: Record<string, any>[]

    if (shouldReturnConvexData('analytics')) {
      const [allTreatments, allExpenses, allPatients] = await Promise.all([
        listClinicTableFromConvex('treatments', clinicId),
        listClinicTableFromConvex('expenses', clinicId),
        listClinicTableFromConvex('patients', clinicId),
      ])
      treatments1Data = allTreatments.filter((t) => t.status !== 'cancelled' && withinRange(t.treatment_date, period1_start, period1_end))
      treatments2Data = allTreatments.filter((t) => t.status !== 'cancelled' && withinRange(t.treatment_date, period2_start, period2_end))
      expenses1Data = allExpenses.filter((e) => withinRange(e.expense_date, period1_start, period1_end))
      expenses2Data = allExpenses.filter((e) => withinRange(e.expense_date, period2_start, period2_end))
      patients1Data = allPatients.filter((p) => withinRange(p.created_at, period1_start, period1_end))
      patients2Data = allPatients.filter((p) => withinRange(p.created_at, period2_start, period2_end))
    } else {
      const [treatments1, treatments2, expenses1, expenses2, patients1, patients2] = await Promise.all([
        supabase
          .from('treatments')
          .select('price_cents, amount_paid_cents, is_paid, status')
          .eq('clinic_id', clinicId)
          .neq('status', 'cancelled')
          .gte('treatment_date', period1_start)
          .lte('treatment_date', period1_end),
        supabase
          .from('treatments')
          .select('price_cents, amount_paid_cents, is_paid, status')
          .eq('clinic_id', clinicId)
          .neq('status', 'cancelled')
          .gte('treatment_date', period2_start)
          .lte('treatment_date', period2_end),
        supabase
          .from('expenses')
          .select('amount_cents')
          .eq('clinic_id', clinicId)
          .gte('expense_date', period1_start)
          .lte('expense_date', period1_end),
        supabase
          .from('expenses')
          .select('amount_cents')
          .eq('clinic_id', clinicId)
          .gte('expense_date', period2_start)
          .lte('expense_date', period2_end),
        supabase
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .gte('created_at', period1_start)
          .lte('created_at', period1_end),
        supabase
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .gte('created_at', period2_start)
          .lte('created_at', period2_end),
      ])
      treatments1Data = treatments1.data || []
      treatments2Data = treatments2.data || []
      expenses1Data = expenses1.data || []
      expenses2Data = expenses2.data || []
      patients1Data = patients1.data || []
      patients2Data = patients2.data || []
    }

    const comparison: Record<string, { period1: number; period2: number; change: number; changePct: number | null }> = {}

    if (metrics.includes('revenue')) {
      const rev1 = treatments1Data.reduce((sum, treatment) => sum + collectedRevenueCents(treatment), 0)
      const rev2 = treatments2Data.reduce((sum, treatment) => sum + collectedRevenueCents(treatment), 0)
      comparison.revenue = {
        period1: rev1,
        period2: rev2,
        change: rev2 - rev1,
        changePct: calculatePercentageChange(rev2, rev1),
      }
    }

    if (metrics.includes('expenses')) {
      const exp1 = expenses1Data.reduce((sum, e) => sum + (e.amount_cents || 0), 0) || 0
      const exp2 = expenses2Data.reduce((sum, e) => sum + (e.amount_cents || 0), 0) || 0
      comparison.expenses = {
        period1: exp1,
        period2: exp2,
        change: exp2 - exp1,
        changePct: calculatePercentageChange(exp2, exp1),
      }
    }

    if (metrics.includes('treatments')) {
      const count1 = treatments1Data.length || 0
      const count2 = treatments2Data.length || 0
      comparison.treatments = {
        period1: count1,
        period2: count2,
        change: count2 - count1,
        changePct: calculatePercentageChange(count2, count1),
      }
    }

    if (metrics.includes('patients')) {
      const pat1 = patients1Data.length || 0
      const pat2 = patients2Data.length || 0
      comparison.patients = {
        period1: pat1,
        period2: pat2,
        change: pat2 - pat1,
        changePct: calculatePercentageChange(pat2, pat1),
      }
    }

    const changes = [
      `📊 Period Comparison`,
      `Period 1: ${period1_start} to ${period1_end}`,
      `Period 2: ${period2_start} to ${period2_end}`,
      '',
    ]

    Object.entries(comparison).forEach(([metric, data]) => {
      const icon = data.changePct === null ? 'ℹ️' : data.changePct > 0 ? '📈' : data.changePct < 0 ? '📉' : '➖'
      const format = metric === 'revenue' || metric === 'expenses' ? formatCurrency : (v: number) => v.toString()
      changes.push(
        `**${metric.charAt(0).toUpperCase() + metric.slice(1)}** ${icon}`,
        `  Period 1: ${format(data.period1)} → Period 2: ${format(data.period2)}`,
        `  Change: ${data.change > 0 ? '+' : ''}${format(data.change)} (${data.changePct === null ? 'no comparison baseline' : `${data.changePct > 0 ? '+' : ''}${data.changePct.toFixed(1)}%`})`,
        ''
      )
    })

    return {
      success: true,
      action: 'compare_periods',
      params,
      result: { changes, comparison },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'compare_periods',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}
