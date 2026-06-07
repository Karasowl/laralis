/**
 * Pricing Actions
 *
 * Core pricing-related action implementations:
 * - update_service_price
 * - adjust_service_margin
 * - simulate_price_change
 * - create_expense
 * - update_time_settings
 */

import type { ActionParams, ActionResult, ActionContext } from '../types'
import { createMirroredSupabaseClient } from '@/lib/convex/supabase-runtime-mirror'
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexTable,
  patchConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
  decodeConvexValue,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

// Convex bookkeeping fields stripped from rows so they mirror the shape Supabase
// would produce. Replicated from lib/snapshots/exporter.ts.
const CONVEX_META_FIELDS = ['_id', '_creationTime', 'legacyId', 'legacyTable', 'convex_created_at', 'convex_updated_at', 'convex_snapshot_source']
function stripConvexRow(row: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    if (CONVEX_META_FIELDS.includes(k)) continue
    clean[k] = v
  }
  return decodeConvexValue(clean) as Record<string, any>
}

function withMirroredSupabase(context: ActionContext): ActionContext {
  return {
    ...context,
    supabase: createMirroredSupabaseClient(context.supabase),
  }
}

/**
 * Execute: Update service price
 */
export async function executeUpdateServicePrice(
  params: ActionParams['update_service_price'],
  context: ActionContext
): Promise<ActionResult> {
  context = withMirroredSupabase(context)
  const { supabase, clinicId, userId, dryRun } = context
  const { service_id, new_price_cents, reason } = params
  const convexRead = shouldReturnConvexData('services')
  const convexWrite = shouldUseConvexOnlyWritePath('services')

  try {
    // Get current service data
    let serviceBefore: Record<string, any> | null = null
    let fetchError: { message?: string } | null = null

    if (convexRead) {
      const row = (await getConvexDocumentByLegacyId('services', service_id)) as Record<string, any> | null
      const stripped = row ? stripConvexRow(row) : null
      // Mirror `.eq('clinic_id', clinicId).single()`: only match within this clinic.
      serviceBefore = stripped && String(stripped.clinic_id) === String(clinicId) ? stripped : null
    } else {
      const result = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .single()
      serviceBefore = result.data
      fetchError = result.error
    }

    if (fetchError || !serviceBefore) {
      return {
        success: false,
        action: 'update_service_price',
        params,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `Service ${service_id} not found`,
          details: fetchError,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // If dry run, just return what would change
    if (dryRun) {
      return {
        success: true,
        action: 'update_service_price',
        params,
        result: {
          before: {
            price_cents: serviceBefore.price_cents,
          },
          after: {
            price_cents: new_price_cents,
          },
          changes: [
            `Price would change from $${(serviceBefore.price_cents / 100).toFixed(2)} to $${(new_price_cents / 100).toFixed(2)}`,
            reason ? `Reason: ${reason}` : '',
          ].filter(Boolean),
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Execute the update
    let serviceAfter: Record<string, any> | null = null
    let updateError: { message?: string } | null = null

    if (convexWrite) {
      const patch = {
        price_cents: new_price_cents,
        updated_at: new Date().toISOString(),
      }
      await patchConvexDocumentByLegacyId('services', service_id, patch)
      serviceAfter = { ...serviceBefore, ...patch }
    } else {
      const result = await supabase
        .from('services')
        .update({
          price_cents: new_price_cents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .select()
        .single()
      serviceAfter = result.data
      updateError = result.error
    }

    if (updateError || !serviceAfter) {
      return {
        success: false,
        action: 'update_service_price',
        params,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update service price',
          details: updateError,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    return {
      success: true,
      action: 'update_service_price',
      params,
      result: {
        before: {
          price_cents: serviceBefore.price_cents,
          name: serviceBefore.name,
        },
        after: {
          price_cents: serviceAfter.price_cents,
          name: serviceAfter.name,
        },
        changes: [
          `Updated price for service "${serviceBefore.name}"`,
          `From: $${(serviceBefore.price_cents / 100).toFixed(2)}`,
          `To: $${(serviceAfter.price_cents / 100).toFixed(2)}`,
          `Change: ${(((new_price_cents - serviceBefore.price_cents) / serviceBefore.price_cents) * 100).toFixed(1)}%`,
          reason ? `Reason: ${reason}` : '',
        ].filter(Boolean),
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'update_service_price',
      params,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error.message || 'Unexpected error',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Execute: Adjust service margin
 * Calculates new price to achieve target margin and optionally updates it
 */
export async function executeAdjustServiceMargin(
  params: ActionParams['adjust_service_margin'],
  context: ActionContext
): Promise<ActionResult> {
  context = withMirroredSupabase(context)
  const { supabase, clinicId, userId, dryRun } = context
  const { service_id, target_margin_pct, adjust_price = false } = params
  const convexRead = shouldReturnConvexData('services')
  const convexWrite = shouldUseConvexOnlyWritePath('services')

  try {
    // Get current service with cost data
    let service: Record<string, any> | null = null
    let fetchError: { message?: string } | null = null

    if (convexRead) {
      const row = (await getConvexDocumentByLegacyId('services', service_id)) as Record<string, any> | null
      const stripped = row ? stripConvexRow(row) : null
      // Mirror `.eq('clinic_id', clinicId).single()`: only match within this clinic.
      service = stripped && String(stripped.clinic_id) === String(clinicId) ? stripped : null
    } else {
      const result = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .single()
      service = result.data
      fetchError = result.error
    }

    if (fetchError || !service) {
      return {
        success: false,
        action: 'adjust_service_margin',
        params,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `Service ${service_id} not found`,
          details: fetchError,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Calculate current costs
    const fixedCostCents = service.fixed_cost_cents || 0
    const variableCostCents = service.variable_cost_cents || 0
    const totalCostCents = fixedCostCents + variableCostCents

    if (totalCostCents === 0) {
      return {
        success: false,
        action: 'adjust_service_margin',
        params,
        error: {
          code: 'ZERO_COST',
          message:
            'Service has zero cost. Cannot calculate margin. Please configure service costs first.',
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Calculate new price for target margin
    // Formula: Price = Cost × (1 + Margin/100)
    const newPriceCents = Math.round(totalCostCents * (1 + target_margin_pct / 100))

    // Calculate current margin for comparison
    const currentPriceCents = service.price_cents || 0
    const currentProfitCents = currentPriceCents - totalCostCents
    const currentMarginPct =
      totalCostCents > 0
        ? Math.round((currentProfitCents / totalCostCents) * 100 * 100) / 100
        : 0

    const newProfitCents = newPriceCents - totalCostCents

    // Build changes description
    const changes = [
      `Service: "${service.name}"`,
      `Total cost: $${(totalCostCents / 100).toFixed(2)} (Fixed: $${(fixedCostCents / 100).toFixed(2)}, Variable: $${(variableCostCents / 100).toFixed(2)})`,
      `Current price: $${(currentPriceCents / 100).toFixed(2)} (${currentMarginPct}% markup)`,
      `Target margin: ${target_margin_pct}%`,
      `Calculated price: $${(newPriceCents / 100).toFixed(2)}`,
      `New profit per service: $${(newProfitCents / 100).toFixed(2)}`,
      `Price change: ${(((newPriceCents - currentPriceCents) / currentPriceCents) * 100).toFixed(1)}%`,
    ]

    // If not adjusting price or dry run, just return calculation
    if (!adjust_price || dryRun) {
      changes.push(
        adjust_price
          ? 'DRY RUN - Price would be updated'
          : 'Calculation only - use adjust_price=true to update'
      )

      return {
        success: true,
        action: 'adjust_service_margin',
        params,
        result: {
          before: {
            price_cents: currentPriceCents,
            margin_pct: currentMarginPct,
            profit_cents: currentProfitCents,
          },
          after: {
            price_cents: newPriceCents,
            margin_pct: target_margin_pct,
            profit_cents: newProfitCents,
          },
          changes,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Execute price update
    let updatedService: Record<string, any> | null = null
    let updateError: { message?: string } | null = null

    if (convexWrite) {
      const patch = {
        price_cents: newPriceCents,
        margin_pct: target_margin_pct,
        updated_at: new Date().toISOString(),
      }
      await patchConvexDocumentByLegacyId('services', service_id, patch)
      updatedService = { ...service, ...patch }
    } else {
      const result = await supabase
        .from('services')
        .update({
          price_cents: newPriceCents,
          margin_pct: target_margin_pct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .select()
        .single()
      updatedService = result.data
      updateError = result.error
    }

    if (updateError || !updatedService) {
      return {
        success: false,
        action: 'adjust_service_margin',
        params,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update service margin',
          details: updateError,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    changes.push('Price updated successfully')

    return {
      success: true,
      action: 'adjust_service_margin',
      params,
      result: {
        before: {
          price_cents: currentPriceCents,
          margin_pct: currentMarginPct,
          profit_cents: currentProfitCents,
          name: service.name,
        },
        after: {
          price_cents: updatedService.price_cents,
          margin_pct: updatedService.margin_pct,
          profit_cents: newProfitCents,
          name: updatedService.name,
        },
        changes,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'adjust_service_margin',
      params,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error.message || 'Unexpected error',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Execute: Simulate price change
 * Read-only simulation of price changes and their impact on revenue
 */
type ServiceRowWithSupplies = {
  id: string
  name: string
  price_cents: number | null
  margin_pct: number | null
  est_minutes: number | null
  service_supplies?: Array<{
    qty: number | null
    supplies: {
      price_cents: number | null
      portions: number | null
    } | null
  }> | null
}

type ServiceRowWithLiveCosts = ServiceRowWithSupplies & {
  fixed_cost_cents: number
  variable_cost_cents: number
  total_cost_cents: number
}

function normalizeProductivityFactor(rawValue: unknown, fallback = 0.8) {
  let value = Number(rawValue ?? fallback)
  if (!Number.isFinite(value) || value < 0) value = fallback
  if (value > 1) value = value / 100
  return Math.min(1, Math.max(0, value))
}

async function getClinicFixedCostPerMinuteCents(
  supabase: ActionContext['supabase'],
  clinicId: string
) {
  const convexRead = shouldReturnConvexData('settings_time')

  let timeSettings: Record<string, any> | null = null
  let fixedCosts: Array<Record<string, any>> | null = null
  let assets: Array<Record<string, any>> | null = null

  if (convexRead) {
    // settings_time: latest row for the clinic (mirror order updated_at desc + limit 1).
    const timeRows = ((await listConvexDocumentsByClinic('settings_time', clinicId)) as Record<string, any>[])
      .map((r) => stripConvexRow(r))
      .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
    timeSettings = timeRows[0] ?? null

    fixedCosts = ((await listConvexDocumentsByClinic('fixed_costs', clinicId)) as Record<string, any>[]).map((r) =>
      stripConvexRow(r)
    )

    assets = ((await listConvexDocumentsByClinic('assets', clinicId)) as Record<string, any>[]).map((r) =>
      stripConvexRow(r)
    )
  } else {
    const timeResult = await supabase
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    timeSettings = timeResult.data

    const fixedCostsResult = await supabase
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId)
    fixedCosts = fixedCostsResult.data

    const assetsResult = await supabase
      .from('assets')
      .select('purchase_price_cents, depreciation_months')
      .eq('clinic_id', clinicId)
    assets = assetsResult.data
  }

  const monthlyFixedCostsCents =
    (fixedCosts || []).reduce((sum, cost: any) => sum + (Number(cost.amount_cents) || 0), 0) +
    (assets || []).reduce((sum, asset: any) => {
      const months = Number(asset.depreciation_months) || 0
      if (months <= 0) return sum
      return sum + Math.round((Number(asset.purchase_price_cents) || 0) / months)
    }, 0)

  if (!timeSettings) return 0

  const workDays = Number(timeSettings.working_days_per_month ?? timeSettings.work_days ?? 0)
  const hoursPerDay = Number(timeSettings.hours_per_day ?? 0)
  const rawProductivity = timeSettings.real_hours_percentage ?? timeSettings.real_pct ?? 0.8
  const productivityFactor = normalizeProductivityFactor(rawProductivity)
  const effectiveMinutes = Math.round(workDays * hoursPerDay * 60 * productivityFactor)

  if (effectiveMinutes <= 0 || monthlyFixedCostsCents <= 0) return 0
  return Math.round(monthlyFixedCostsCents / effectiveMinutes)
}

function calculateServiceVariableCostCents(service: ServiceRowWithSupplies) {
  return (service.service_supplies || []).reduce((total, item) => {
    const price = Number(item.supplies?.price_cents) || 0
    const portions = Number(item.supplies?.portions) || 0
    const qty = Number(item.qty) || 0
    if (price <= 0 || portions <= 0 || qty <= 0) return total
    return total + Math.round((price / portions) * qty)
  }, 0)
}

function addLiveServiceCosts(
  services: ServiceRowWithSupplies[],
  fixedCostPerMinuteCents: number
): ServiceRowWithLiveCosts[] {
  return services.map((service) => {
    const variableCostCents = calculateServiceVariableCostCents(service)
    const fixedCostCents = Math.round((Number(service.est_minutes) || 0) * fixedCostPerMinuteCents)

    return {
      ...service,
      fixed_cost_cents: fixedCostCents,
      variable_cost_cents: variableCostCents,
      total_cost_cents: fixedCostCents + variableCostCents,
    }
  })
}

function missingColumnFromSupabaseError(error: { message?: string } | null | undefined) {
  const match = error?.message?.match(/Could not find the '([^']+)' column/)
  return match?.[1] || null
}

/**
 * Reconstruct the nested `services -> service_supplies -> supplies` shape from the
 * flat Convex tables (convex-only mode). Mirrors the Supabase embedded select used by
 * executeSimulatePriceChange. Optionally narrows to a single service_id.
 */
async function listServicesWithSuppliesFromConvex(
  clinicId: string,
  serviceId?: string
): Promise<ServiceRowWithSupplies[]> {
  const services = ((await listConvexDocumentsByClinic('services', clinicId)) as Record<string, any>[])
    .map((r) => stripConvexRow(r))
    .filter((s) => (serviceId ? String(s.id) === String(serviceId) : true))

  if (services.length === 0) return []

  // Index service_supplies by service_id (FK), and supplies by id, then join in JS.
  const serviceIdSet = new Set(services.map((s) => String(s.id)))
  const serviceSupplies = ((await listConvexTable('service_supplies')) as Record<string, any>[])
    .map((r) => stripConvexRow(r))
    .filter((ss) => ss.service_id != null && serviceIdSet.has(String(ss.service_id)))

  const suppliesById = new Map<string, Record<string, any>>()
  for (const supply of (await listConvexTable('supplies')) as Record<string, any>[]) {
    const clean = stripConvexRow(supply)
    if (clean.id != null) suppliesById.set(String(clean.id), clean)
  }

  const suppliesByService = new Map<string, ServiceRowWithSupplies['service_supplies']>()
  for (const ss of serviceSupplies) {
    const supply = ss.supply_id != null ? suppliesById.get(String(ss.supply_id)) : null
    const key = String(ss.service_id)
    const list = suppliesByService.get(key) ?? []
    list!.push({
      qty: ss.qty ?? null,
      supplies: supply
        ? { price_cents: supply.price_cents ?? null, portions: supply.portions ?? null }
        : null,
    })
    suppliesByService.set(key, list)
  }

  return services.map((s) => ({
    id: s.id,
    name: s.name,
    price_cents: s.price_cents ?? null,
    margin_pct: s.margin_pct ?? null,
    est_minutes: s.est_minutes ?? null,
    service_supplies: suppliesByService.get(String(s.id)) ?? [],
  }))
}

export async function executeSimulatePriceChange(
  params: ActionParams['simulate_price_change'],
  context: ActionContext
): Promise<ActionResult> {
  context = withMirroredSupabase(context)
  const { supabase, clinicId, userId } = context
  const { service_id, change_type, change_value } = params
  const convexRead = shouldReturnConvexData('services')

  try {
    // Build services query (with nested supply recipe for variable cost)
    let services: ServiceRowWithSupplies[] | null = null
    let servicesError: { message?: string } | null = null

    if (convexRead) {
      services = await listServicesWithSuppliesFromConvex(clinicId, service_id)
    } else {
      let servicesQuery = supabase
        .from('services')
        .select(`
          id,
          name,
          price_cents,
          margin_pct,
          est_minutes,
          service_supplies!service_supplies_service_id_fkey (
            qty,
            supplies!service_supplies_supply_id_fkey (
              price_cents,
              portions
            )
          )
        `)
        .eq('clinic_id', clinicId)

      if (service_id) {
        servicesQuery = servicesQuery.eq('id', service_id)
      }

      const result = await servicesQuery
      services = result.data as unknown as ServiceRowWithSupplies[] | null
      servicesError = result.error
    }

    if (servicesError || !services || services.length === 0) {
      return {
        success: false,
        action: 'simulate_price_change',
        params,
        error: {
          code: 'NO_SERVICES_FOUND',
          message: service_id
            ? `Service ${service_id} not found`
            : 'No services found in clinic',
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    const fixedCostPerMinuteCents = await getClinicFixedCostPerMinuteCents(supabase, clinicId)
    const servicesWithLiveCosts = addLiveServiceCosts(services, fixedCostPerMinuteCents)

    // Get historical treatment data for volume estimation (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoDate = thirtyDaysAgo.toISOString().split('T')[0]

    let treatments: Array<{ service_id: string; price_cents: number | null }> | null = null

    if (convexRead) {
      treatments = ((await listConvexDocumentsByClinic('treatments', clinicId)) as Record<string, any>[])
        .map((r) => stripConvexRow(r))
        // Mirror `.gte('treatment_date', thirtyDaysAgoDate)` (date-string comparison).
        .filter((t) => t.treatment_date != null && String(t.treatment_date) >= thirtyDaysAgoDate)
        .map((t) => ({ service_id: t.service_id, price_cents: t.price_cents ?? null }))
    } else {
      const result = await supabase
        .from('treatments')
        .select('service_id, price_cents')
        .eq('clinic_id', clinicId)
        .gte('treatment_date', thirtyDaysAgoDate)
      treatments = result.data
    }

    // Count treatments by service
    const treatmentCounts: Record<string, number> = {}
    const treatmentRevenue: Record<string, number> = {}

    treatments?.forEach((t) => {
      treatmentCounts[t.service_id] = (treatmentCounts[t.service_id] || 0) + 1
      treatmentRevenue[t.service_id] =
        (treatmentRevenue[t.service_id] || 0) + (t.price_cents || 0)
    })

    // Calculate simulation results
    const simulationResults = servicesWithLiveCosts.map((service) => {
      const currentPrice = service.price_cents || 0
      const treatmentCount = treatmentCounts[service.id] || 0
      const currentMonthlyRevenue = treatmentRevenue[service.id] || 0

      // Calculate new price based on change type
      let newPrice: number
      if (change_type === 'percentage') {
        newPrice = Math.round(currentPrice * (1 + change_value / 100))
      } else {
        // fixed - change_value is in cents
        newPrice = currentPrice + change_value
      }

      // Ensure price doesn't go negative
      newPrice = Math.max(0, newPrice)

      // Calculate new revenue estimate (assuming same volume)
      const newMonthlyRevenue =
        treatmentCount > 0 && currentPrice > 0
          ? Math.round((newPrice / currentPrice) * currentMonthlyRevenue)
          : treatmentCount > 0
            ? newPrice * treatmentCount
          : 0

      // Calculate profit changes
      const totalCost = service.total_cost_cents
      const currentProfit = currentPrice - totalCost
      const newProfit = newPrice - totalCost

      const currentMargin = totalCost > 0 ? (currentProfit / totalCost) * 100 : 0
      const newMargin = totalCost > 0 ? (newProfit / totalCost) * 100 : 0

      return {
        service_id: service.id,
        service_name: service.name,
        treatment_count: treatmentCount,
        current_price_cents: currentPrice,
        new_price_cents: newPrice,
        price_change_pct:
          currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0,
        current_monthly_revenue_cents: currentMonthlyRevenue,
        new_monthly_revenue_cents: newMonthlyRevenue,
        revenue_change_cents: newMonthlyRevenue - currentMonthlyRevenue,
        revenue_change_pct:
          currentMonthlyRevenue > 0
            ? ((newMonthlyRevenue - currentMonthlyRevenue) / currentMonthlyRevenue) * 100
            : 0,
        fixed_cost_cents: service.fixed_cost_cents,
        variable_cost_cents: service.variable_cost_cents,
        total_cost_cents: service.total_cost_cents,
        current_margin_pct: Math.round(currentMargin * 100) / 100,
        new_margin_pct: Math.round(newMargin * 100) / 100,
        current_profit_per_treatment_cents: currentProfit,
        new_profit_per_treatment_cents: newProfit,
      }
    })

    // Calculate totals
    const totalCurrentRevenue = simulationResults.reduce(
      (sum, r) => sum + r.current_monthly_revenue_cents,
      0
    )
    const totalNewRevenue = simulationResults.reduce(
      (sum, r) => sum + r.new_monthly_revenue_cents,
      0
    )
    const totalRevenueChange = totalNewRevenue - totalCurrentRevenue
    const totalRevenueChangePct =
      totalCurrentRevenue > 0 ? (totalRevenueChange / totalCurrentRevenue) * 100 : 0

    const totalTreatments = simulationResults.reduce(
      (sum, r) => sum + r.treatment_count,
      0
    )

    // Build summary
    const changes = [
      `Simulation Type: ${change_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}`,
      `Change Value: ${change_type === 'percentage' ? `${change_value}%` : `$${(change_value / 100).toFixed(2)}`}`,
      `Services Affected: ${services.length}`,
      `Historical Data: ${totalTreatments} treatments in last 30 days`,
      '',
      'AGGREGATE IMPACT:',
      `  Current Monthly Revenue: $${(totalCurrentRevenue / 100).toFixed(2)}`,
      `  Projected Monthly Revenue: $${(totalNewRevenue / 100).toFixed(2)}`,
      `  Revenue Change: ${totalRevenueChange >= 0 ? '+' : ''}$${(totalRevenueChange / 100).toFixed(2)} (${totalRevenueChangePct.toFixed(1)}%)`,
      '',
      'ASSUMPTIONS:',
      `  - Treatment volume remains constant`,
      `  - No price elasticity considered (demand may change with price)`,
      `  - Based on last 30 days of data`,
    ]

    return {
      success: true,
      action: 'simulate_price_change',
      params,
      result: {
        before: {
          total_monthly_revenue_cents: totalCurrentRevenue,
          services_count: services.length,
          total_treatments: totalTreatments,
        },
        after: {
          total_monthly_revenue_cents: totalNewRevenue,
          revenue_change_cents: totalRevenueChange,
          revenue_change_pct: Math.round(totalRevenueChangePct * 100) / 100,
        },
        changes,
        simulation_by_service: simulationResults,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'simulate_price_change',
      params,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error.message || 'Unexpected error',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Execute: Create expense
 * Creates a new expense record in the database
 */
export async function executeCreateExpense(
  params: ActionParams['create_expense'],
  context: ActionContext
): Promise<ActionResult> {
  context = withMirroredSupabase(context)
  const { supabase, clinicId, userId, dryRun } = context
  const { amount_cents, category_id, description, expense_date } = params
  const convexRead = shouldReturnConvexData('categories')
  const convexWrite = shouldUseConvexOnlyWritePath('expenses')

  try {
    // Verify category exists
    let category: { id: string; name: string; display_name?: string | null } | null = null
    let categoryError: { message?: string } | null = null

    if (convexRead) {
      const row = (await getConvexDocumentByLegacyId('categories', category_id)) as Record<string, any> | null
      const stripped = row ? stripConvexRow(row) : null
      category = stripped
        ? { id: stripped.id, name: stripped.name, display_name: stripped.display_name ?? null }
        : null
    } else {
      const result = await supabase
        .from('categories')
        .select('id, name, display_name')
        .eq('id', category_id)
        .single()
      category = result.data
      categoryError = result.error
    }

    if (categoryError || !category) {
      return {
        success: false,
        action: 'create_expense',
        params,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: `Category ${category_id} not found`,
          details: categoryError,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    const categoryName = category.display_name || category.name

    // If dry run, just return what would be created
    if (dryRun) {
      return {
        success: true,
        action: 'create_expense',
        params,
        result: {
          preview: {
            amount_cents,
            amount_display: `$${(amount_cents / 100).toFixed(2)}`,
            category: categoryName,
            description,
            expense_date,
          },
          changes: [
            `Would create expense: "${description}"`,
            `Amount: $${(amount_cents / 100).toFixed(2)}`,
            `Category: ${categoryName}`,
            `Date: ${expense_date}`,
          ],
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Execute the insert
    let expense: Record<string, any> | null = null
    let insertError: { message?: string } | null = null

    if (convexWrite) {
      const newId = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      const row = {
        id: newId,
        clinic_id: clinicId,
        amount_cents,
        category: categoryName,
        category_id,
        description,
        expense_date,
        auto_processed: false,
        created_at: nowIso,
        updated_at: nowIso,
      }
      await upsertConvexDocumentByLegacyId('expenses', newId, row)
      expense = row
    } else {
      const result = await supabase
        .from('expenses')
        .insert({
          clinic_id: clinicId,
          amount_cents,
          category: categoryName,
          category_id,
          description,
          expense_date,
          auto_processed: false,
        })
        .select()
        .single()
      expense = result.data
      insertError = result.error
    }

    if (insertError || !expense) {
      return {
        success: false,
        action: 'create_expense',
        params,
        error: {
          code: 'INSERT_FAILED',
          message: 'Failed to create expense',
          details: insertError,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    return {
      success: true,
      action: 'create_expense',
      params,
      result: {
        created: {
          id: expense.id,
          amount_cents: expense.amount_cents,
          amount_display: `$${(expense.amount_cents / 100).toFixed(2)}`,
          category: categoryName,
          description: expense.description,
          expense_date: expense.expense_date,
        },
        changes: [
          `Created expense: "${description}"`,
          `Amount: $${(amount_cents / 100).toFixed(2)}`,
          `Category: ${categoryName}`,
          `Date: ${expense_date}`,
        ],
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    console.error('[AIService] Error in executeCreateExpense:', error)
    return {
      success: false,
      action: 'create_expense',
      params,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message || 'Unknown error occurred',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Execute: Update time settings
 * Updates work schedule and productivity settings for the clinic
 */
export async function executeUpdateTimeSettings(
  params: ActionParams['update_time_settings'],
  context: ActionContext
): Promise<ActionResult> {
  context = withMirroredSupabase(context)
  const { supabase, clinicId, userId, dryRun } = context
  const { work_days, hours_per_day, real_productivity_pct } = params
  const convexRead = shouldReturnConvexData('settings_time')
  const convexWrite = shouldUseConvexOnlyWritePath('settings_time')

  try {
    // Get current settings
    let currentSettings: Record<string, any> | null = null

    if (convexRead) {
      // Mirror order updated_at desc + limit 1: pick the latest row for the clinic.
      const rows = ((await listConvexDocumentsByClinic('settings_time', clinicId)) as Record<string, any>[])
        .map((r) => stripConvexRow(r))
        .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
      currentSettings = rows[0] ?? null
    } else {
      const result = await supabase
        .from('settings_time')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      currentSettings = result.data
    }

    // Build update payload with only provided values
    const updates: Record<string, any> = {}
    const changes: string[] = []

    // Get current values (handle both old and new schema)
    const currentWorkDays =
      currentSettings?.working_days_per_month ?? currentSettings?.work_days ?? 22
    const currentHoursPerDay = currentSettings?.hours_per_day ?? 8
    const rawRealPct =
      currentSettings?.real_hours_percentage ?? currentSettings?.real_pct ?? 0.8
    const currentRealPct = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct

    if (work_days !== undefined) {
      updates.work_days = work_days
      updates.working_days_per_month = work_days
      changes.push(`Work days: ${currentWorkDays} → ${work_days} days/month`)
    }

    if (hours_per_day !== undefined) {
      updates.hours_per_day = hours_per_day
      changes.push(`Hours per day: ${currentHoursPerDay} → ${hours_per_day} hours`)
    }

    if (real_productivity_pct !== undefined) {
      // DB expects decimal (0-1), we receive percentage (0-100)
      const realPctDecimal = real_productivity_pct / 100
      updates.real_pct = realPctDecimal
      updates.real_hours_percentage = realPctDecimal
      changes.push(
        `Productivity: ${currentRealPct.toFixed(0)}% → ${real_productivity_pct}%`
      )
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        action: 'update_time_settings',
        params,
        error: {
          code: 'NO_CHANGES',
          message: 'No settings provided to update',
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Calculate impact on fixed cost per minute
    const newWorkDays = work_days ?? currentWorkDays
    const newHoursPerDay = hours_per_day ?? currentHoursPerDay
    const newRealPct = real_productivity_pct ?? currentRealPct

    const currentMinutesMonth =
      currentWorkDays * currentHoursPerDay * 60 * (currentRealPct / 100)
    const newMinutesMonth = newWorkDays * newHoursPerDay * 60 * (newRealPct / 100)

    changes.push('')
    changes.push(`Impact on capacity:`)
    changes.push(
      `Effective minutes/month: ${Math.round(currentMinutesMonth)} → ${Math.round(newMinutesMonth)}`
    )

    if (newMinutesMonth !== currentMinutesMonth) {
      const percentChange = (
        ((newMinutesMonth - currentMinutesMonth) / currentMinutesMonth) *
        100
      ).toFixed(1)
      changes.push(`Change: ${percentChange}%`)
      changes.push(`This will affect fixed cost per minute for all services`)
    }

    // If dry run, just return what would change
    if (dryRun) {
      return {
        success: true,
        action: 'update_time_settings',
        params,
        result: {
          before: {
            work_days: currentWorkDays,
            hours_per_day: currentHoursPerDay,
            real_productivity_pct: currentRealPct,
            effective_minutes_month: Math.round(currentMinutesMonth),
          },
          after: {
            work_days: newWorkDays,
            hours_per_day: newHoursPerDay,
            real_productivity_pct: newRealPct,
            effective_minutes_month: Math.round(newMinutesMonth),
          },
          changes: ['DRY RUN - Settings would be updated:', ...changes],
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Execute the update
    updates.updated_at = new Date().toISOString()

    const persistTimeSettings = async (
      payload: Record<string, any>
    ): Promise<{ data: Record<string, any> | null; error: { message?: string } | null }> => {
      if (convexWrite) {
        // Convex-only write path: patch the existing row or insert a new one.
        if (currentSettings) {
          await patchConvexDocumentByLegacyId('settings_time', currentSettings.id, payload)
          return { data: { ...currentSettings, ...payload }, error: null }
        }

        const newId = crypto.randomUUID()
        const row = {
          id: newId,
          clinic_id: clinicId,
          ...payload,
        }
        await upsertConvexDocumentByLegacyId('settings_time', newId, row)
        return { data: row, error: null }
      }

      if (currentSettings) {
        return supabase
          .from('settings_time')
          .update(payload)
          .eq('id', currentSettings.id)
          .select()
          .single()
      }

      return supabase
        .from('settings_time')
        .insert({
          clinic_id: clinicId,
          ...payload,
        })
        .select()
        .single()
    }

    let attemptedPayload: Record<string, unknown> = currentSettings
      ? { ...updates }
      : {
          work_days: work_days ?? 22,
          working_days_per_month: work_days ?? 22,
          hours_per_day: hours_per_day ?? 8,
          real_pct: (real_productivity_pct ?? 80) / 100,
          real_hours_percentage: (real_productivity_pct ?? 80) / 100,
          ...updates,
        }
    let result = await persistTimeSettings(attemptedPayload)

    for (let attempts = 0; result.error && attempts < 5; attempts += 1) {
      const missingColumn = missingColumnFromSupabaseError(result.error)
      if (!missingColumn || !(missingColumn in attemptedPayload)) break

      const { [missingColumn]: _removed, ...nextPayload } = attemptedPayload
      attemptedPayload = nextPayload
      result = await persistTimeSettings(attemptedPayload)
    }

    if (result.error) {
      return {
        success: false,
        action: 'update_time_settings',
        params,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update time settings',
          details: result.error,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    return {
      success: true,
      action: 'update_time_settings',
      params,
      result: {
        before: {
          work_days: currentWorkDays,
          hours_per_day: currentHoursPerDay,
          real_productivity_pct: currentRealPct,
          effective_minutes_month: Math.round(currentMinutesMonth),
        },
        after: {
          work_days: newWorkDays,
          hours_per_day: newHoursPerDay,
          real_productivity_pct: newRealPct,
          effective_minutes_month: Math.round(newMinutesMonth),
        },
        changes: ['Settings updated:', ...changes],
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    console.error('[AIService] Error in executeUpdateTimeSettings:', error)
    return {
      success: false,
      action: 'update_time_settings',
      params,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message || 'Unknown error occurred',
        details: error,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}
