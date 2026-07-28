/**
 * Clinic Snapshot Service
 *
 * Generates a complete snapshot of clinic data for AI context.
 * Loads ALL tables, pre-computes analytics, and includes app schema.
 *
 * This comprehensive snapshot gives Kimi K2 Thinking full context
 * to answer questions accurately without saying "no data available".
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { snapshotCache } from './cache/snapshot-cache'
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexTable,
  decodeConvexValue,
} from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

// Convex bookkeeping fields stripped from rows so the result mirrors the shape the
// Supabase query would return. Same set the snapshot exporter strips on read.
const CONVEX_META_FIELDS = [
  '_id',
  '_creationTime',
  'legacyId',
  'legacyTable',
  'convex_created_at',
  'convex_updated_at',
  'convex_snapshot_source',
]

function stripConvexRow(row: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    if (CONVEX_META_FIELDS.includes(k)) continue
    clean[k] = v
  }
  return decodeConvexValue(clean) as Record<string, any>
}

function stripConvexRows(rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map((r) => stripConvexRow(r))
}

// ============================================================================
// Types
// ============================================================================

interface SnapshotOptions {
  period?: number // Days to look back (default: 30)
  forceRefresh?: boolean // Skip cache and load fresh data
  cacheTtlMs?: number // Custom cache TTL in milliseconds
}

interface AppSchema {
  version: string
  modules: Record<string, ModuleInfo>
  business_formulas: Record<string, string>
}

interface ModuleInfo {
  description: string
  key_fields: string[]
  relationships: string[]
}

interface TimeSettings {
  work_days: number
  hours_per_day: number
  real_productivity_pct: number
  available_treatment_minutes: number
}

interface CalculationMetadata {
  avg_treatment_price_cents: number
  price_data_source: 'historical' | 'configured' | 'none'
  historical_treatments_count: number
  configured_services_count: number
  services_with_pricing_count: number
  warning: string | null
}

interface BreakEvenAnalytics {
  revenue_cents: number
  treatments_needed: number
  current_treatments: number
  gap: number
  status: 'above' | 'at' | 'below'
  calculation_metadata: CalculationMetadata
}

interface FullTreatment {
  id: string
  date: string
  time: string | null
  patient: string
  service: string
  price_cents: number
  duration_minutes: number | null
  status: string | null
  tooth_number: string | null
  is_paid: boolean
  notes: string | null
}

interface FullPatient {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string | null
  first_visit_date: string | null
}

interface FullClinicSnapshot {
  app_schema: AppSchema
  clinic: {
    id: string
    name: string
    time_settings: TimeSettings
  }
  data: {
    patients: any
    treatments: any
    services: any
    supplies: any
    assets: any
    expenses: any
    fixed_costs: any
    leads: any
    inbox_conversations: any
    inbox_messages: any
    // Full records for AI context (with notes, times, etc.)
    full_patients: FullPatient[]
    full_treatments: FullTreatment[]
  }
  analytics: {
    break_even: BreakEvenAnalytics
    margins: any
    profitability: any
    efficiency: any
    top_performers: any
    leads: any
  }
}

// ============================================================================
// Service
// ============================================================================

export class ClinicSnapshotService {
  /**
   * Generate complete clinic snapshot with all data and pre-computed analytics.
   * Uses in-memory cache (30 min TTL) to reduce database queries by ~88%.
   *
   * @param supabase - Supabase client
   * @param clinicId - Clinic ID to generate snapshot for
   * @param options.period - Days to look back (default: 30)
   * @param options.forceRefresh - Skip cache and load fresh data
   * @param options.cacheTtlMs - Custom cache TTL in milliseconds (default: 30 min)
   */
  async getFullSnapshot(
    supabase: SupabaseClient,
    clinicId: string,
    options: SnapshotOptions = {}
  ): Promise<FullClinicSnapshot> {
    const { forceRefresh = false, cacheTtlMs } = options

    // If force refresh, invalidate cache first
    if (forceRefresh) {
      snapshotCache.invalidate(clinicId)
    }

    // Use cache with loader function
    return snapshotCache.getOrLoad(
      clinicId,
      () => this.loadFreshSnapshot(supabase, clinicId, options),
      cacheTtlMs
    )
  }

  /**
   * Invalidate cached snapshot for a clinic.
   * Call this when clinic data changes (services, expenses, settings, etc.)
   */
  invalidateCache(clinicId: string): void {
    snapshotCache.invalidate(clinicId)
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return snapshotCache.getStats()
  }

  /**
   * Check if clinic has cached snapshot
   */
  hasCachedSnapshot(clinicId: string): boolean {
    return snapshotCache.has(clinicId)
  }

  /**
   * Load fresh snapshot from database (internal method)
   */
  private async loadFreshSnapshot(
    supabase: SupabaseClient,
    clinicId: string,
    options: SnapshotOptions = {}
  ): Promise<FullClinicSnapshot> {
    const period = options.period || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)

    // Load clinic info first (needed for calculations)
    const clinic = await this.loadClinicInfo(supabase, clinicId)

    // Load assets and fixed costs first (needed for services calculation)
    const [assets, fixedCosts] = await Promise.all([
      this.loadAssets(supabase, clinicId),
      this.loadFixedCosts(supabase, clinicId),
    ])

    // Load remaining data in parallel
    const [
      patients,
      treatments,
      services,
      supplies,
      expenses,
      fullPatients,
      fullTreatments,
      leads,
      inboxConversations,
      inboxMessages,
    ] = await Promise.all([
      this.loadPatients(supabase, clinicId, startDate),
      this.loadTreatments(supabase, clinicId, startDate),
      this.loadServices(supabase, clinicId, clinic, fixedCosts, assets),
      this.loadSupplies(supabase, clinicId),
      this.loadExpenses(supabase, clinicId, startDate),
      this.loadFullPatients(supabase, clinicId),
      this.loadFullTreatments(supabase, clinicId, startDate),
      this.loadLeads(supabase, clinicId, startDate),
      this.loadInboxConversations(supabase, clinicId),
      this.loadInboxMessages(supabase, clinicId, startDate),
    ])

    // Calculate analytics using all the loaded data
    const analytics = this.calculateAnalytics({
      clinic,
      patients,
      treatments,
      services,
      supplies,
      assets,
      expenses,
      fixedCosts,
      leads,
      period,
    })

    // Build complete snapshot
    const snapshot: FullClinicSnapshot = {
      app_schema: this.getAppSchema(),
      clinic,
      data: {
        patients: this.optimizeJson(patients),
        treatments: this.optimizeJson(treatments),
        services: this.optimizeJson(services),
        supplies: this.optimizeJson(supplies),
        assets: this.optimizeJson(assets),
        expenses: this.optimizeJson(expenses),
        fixed_costs: this.optimizeJson(fixedCosts),
        leads: this.optimizeJson(leads),
        inbox_conversations: this.optimizeJson(inboxConversations),
        inbox_messages: this.optimizeJson(inboxMessages),
        // Full patient and treatment records with notes for AI context
        full_patients: this.optimizeJson(fullPatients),
        full_treatments: this.optimizeJson(fullTreatments),
      },
      analytics: this.optimizeJson(analytics),
    }

    return snapshot
  }

  // ==========================================================================
  // Data Loaders
  // ==========================================================================

  private async loadClinicInfo(supabase: SupabaseClient, clinicId: string) {
    let clinic: { id?: string; name?: string } | null
    let timeSettings: any

    if (shouldReturnConvexData('clinics')) {
      const clinicRow = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
        | Record<string, any>
        | null
      clinic = clinicRow ? (stripConvexRow(clinicRow) as { id?: string; name?: string }) : null

      const timeRows = (await listConvexDocumentsByClinic('settings_time', clinicId)) as Record<
        string,
        any
      >[]
      timeSettings = timeRows.length > 0 ? stripConvexRow(timeRows[0]) : null
    } else {
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('id', clinicId)
        .single()
      clinic = clinicData

      const { data: timeData } = await supabase
        .from('settings_time')
        .select('*')
        .eq('clinic_id', clinicId)
        .single()
      timeSettings = timeData
    }

    // Calculate available treatment minutes
    // Use correct field names from settings_time table schema
    const workDays = timeSettings?.work_days || 20
    const hoursPerDay = timeSettings?.hours_per_day || 7
    const rawRealPct = timeSettings?.real_pct ?? 0.8
    // DB stores as decimal (0-1), so if value <= 1, use as-is; otherwise convert from percentage
    const realPctFactor = rawRealPct <= 1 ? rawRealPct : rawRealPct / 100
    // For display, convert to percentage (0-100)
    const realPctDisplay = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct

    const availableMinutes = workDays * hoursPerDay * 60 * realPctFactor

    return {
      id: clinic?.id || clinicId,
      name: clinic?.name || 'Unknown Clinic',
      time_settings: {
        work_days: workDays,
        hours_per_day: hoursPerDay,
        real_productivity_pct: realPctDisplay,
        available_treatment_minutes: Math.round(availableMinutes),
      },
    }
  }

  private async loadPatients(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    let totalPatients: number | null
    let newPatients: any[] | null
    let activeTreatments: { patient_id: string }[] | null

    if (shouldReturnConvexData('patients')) {
      const startIso = startDate.toISOString()
      const allPatients = stripConvexRows(
        (await listConvexDocumentsByClinic('patients', clinicId)) as Record<string, any>[]
      )
      totalPatients = allPatients.length

      // Resolve patient_sources(name) join manually via id -> name map
      const sources = stripConvexRows(
        (await listConvexDocumentsByClinic('patient_sources', clinicId)) as Record<string, any>[]
      )
      const sourceNameById = new Map(sources.map((s) => [String(s.id), s.name]))

      newPatients = allPatients
        .filter((p) => p.created_at && String(p.created_at) >= startIso)
        .map((p) => ({
          id: p.id,
          created_at: p.created_at,
          source_id: p.source_id,
          patient_sources: p.source_id ? { name: sourceNameById.get(String(p.source_id)) } : null,
        }))

      activeTreatments = stripConvexRows(
        (await listConvexDocumentsByClinic('treatments', clinicId)) as Record<string, any>[]
      )
        .filter((t) => t.treatment_date && String(t.treatment_date) >= startIso)
        .map((t) => ({ patient_id: t.patient_id }))
    } else {
      // Total patients
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
      totalPatients = count ?? null

      // New patients in period with source information
      const { data: newData } = await supabase
        .from('patients')
        .select('id, created_at, source_id, patient_sources(name)')
        .eq('clinic_id', clinicId)
        .gte('created_at', startDate.toISOString())
      newPatients = newData

      // Active patients (with treatments in period)
      const { data: activeData } = await supabase
        .from('treatments')
        .select('patient_id')
        .eq('clinic_id', clinicId)
        .gte('treatment_date', startDate.toISOString())
      activeTreatments = activeData
    }

    const activePatientIds = new Set(
      activeTreatments?.map((t) => t.patient_id) || []
    )

    // Group by source
    const bySource = (newPatients || []).reduce(
      (acc, p: any) => {
        const sourceName = p.patient_sources?.name || 'unknown'
        acc[sourceName] = (acc[sourceName] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total: totalPatients || 0,
      new_in_period: newPatients?.length || 0,
      active_in_period: activePatientIds.size,
      by_source: bySource,
    }
  }

  private async loadTreatments(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    let treatments: any[] | null

    if (shouldReturnConvexData('treatments')) {
      const startIso = startDate.toISOString()
      // Resolve services!inner(name) join manually via id -> name map
      const services = stripConvexRows(
        (await listConvexDocumentsByClinic('services', clinicId)) as Record<string, any>[]
      )
      const serviceNameById = new Map(services.map((s) => [String(s.id), s.name]))

      treatments = stripConvexRows(
        (await listConvexDocumentsByClinic('treatments', clinicId)) as Record<string, any>[]
      )
        // services!inner => only treatments with a matching service
        .filter(
          (t) =>
            t.treatment_date &&
            String(t.treatment_date) >= startIso &&
            t.service_id != null &&
            serviceNameById.has(String(t.service_id))
        )
        .sort((a, b) => String(b.treatment_date).localeCompare(String(a.treatment_date)))
        .map((t) => ({
          id: t.id,
          treatment_date: t.treatment_date,
          price_cents: t.price_cents,
          service_id: t.service_id,
          services: { name: serviceNameById.get(String(t.service_id)) },
        }))
    } else {
      const { data } = await supabase
        .from('treatments')
        .select(
          `
        id,
        treatment_date,
        price_cents,
        service_id,
        services!inner(name)
      `
        )
        .eq('clinic_id', clinicId)
        .gte('treatment_date', startDate.toISOString())
        .order('treatment_date', { ascending: false })
      treatments = data
    }

    const total = treatments?.length || 0
    const totalRevenue =
      treatments?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0
    const avgPrice = total > 0 ? totalRevenue / total : 0

    // Group by service
    const byService: Record<string, { count: number; revenue_cents: number }> = (
      treatments || []
    ).reduce(
      (acc: Record<string, { count: number; revenue_cents: number }>, t: any) => {
        const serviceName = (t.services as any)?.name || 'Unknown'
        if (!acc[serviceName]) {
          acc[serviceName] = { count: 0, revenue_cents: 0 }
        }
        acc[serviceName].count += 1
        acc[serviceName].revenue_cents += t.price_cents || 0
        return acc
      },
      {} as Record<string, { count: number; revenue_cents: number }>
    )

    return {
      total_in_period: total,
      total_revenue_cents: totalRevenue,
      avg_price_cents: Math.round(avgPrice),
      by_service: Object.entries(byService).map(([name, stats]) => ({
        service_name: name,
        ...stats,
      })),
    }
  }

  private async loadServices(
    supabase: SupabaseClient,
    clinicId: string,
    clinic: any,
    fixedCosts: any,
    assets: any
  ) {
    let services: any[] | null
    let supplies: any[] | null
    let serviceSupplies: any[] | null

    if (shouldReturnConvexData('services')) {
      services = stripConvexRows(
        (await listConvexDocumentsByClinic('services', clinicId)) as Record<string, any>[]
      ).sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))

      supplies = stripConvexRows(
        (await listConvexDocumentsByClinic('supplies', clinicId)) as Record<string, any>[]
      )

      // service_supplies is indirect (FK service_id) -> resolve service ids then filter
      const serviceIds = new Set((services || []).map((s) => String(s.id)))
      serviceSupplies = stripConvexRows(
        (await listConvexTable('service_supplies')) as Record<string, any>[]
      ).filter((ss) => ss.service_id != null && serviceIds.has(String(ss.service_id)))
    } else {
      // Get all services with their direct price_cents field
      // Services have pricing directly in the table (tariffs table is DEPRECATED)
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, name, est_minutes, price_cents, is_active')
        .eq('clinic_id', clinicId)
        .order('name')

      if (servicesError) {
        console.error('[ClinicSnapshotService] Error loading services:', servicesError)
        return {
          total_configured: 0,
          with_pricing: 0,
          with_supplies: 0,
          list: [],
        }
      }
      services = servicesData

      // Load all supplies for cost calculation
      const { data: suppliesData } = await supabase
        .from('supplies')
        .select('id, price_cents, portions')
        .eq('clinic_id', clinicId)
      supplies = suppliesData

      // Load service_supplies relationships
      const { data: serviceSuppliesData } = await supabase
        .from('service_supplies')
        .select('service_id, supply_id, qty')
        .in(
          'service_id',
          services?.map((s) => s.id) || []
        )
      serviceSupplies = serviceSuppliesData
    }

    // Calculate fixed cost per minute (same as /api/services)
    const monthlyFixedCostsCents = fixedCosts.monthly_total_cents + assets.monthly_depreciation_cents
    const workDays = clinic.time_settings.work_days
    const hoursPerDay = clinic.time_settings.hours_per_day
    const realPct = clinic.time_settings.real_productivity_pct / 100
    const minutesMonth = workDays * hoursPerDay * 60
    const effectiveMinutes = minutesMonth * realPct

    const fixedCostPerMinuteCents = effectiveMinutes > 0 && monthlyFixedCostsCents > 0
      ? Math.round(monthlyFixedCostsCents / effectiveMinutes)
      : 0

    console.log('[ClinicSnapshotService] Services loaded:', {
      count: services?.length || 0,
      supplies_count: supplies?.length || 0,
      service_supplies_count: serviceSupplies?.length || 0,
      fixed_cost_per_minute_cents: fixedCostPerMinuteCents,
    })

    // Count services with supplies
    const servicesWithSupplies = new Set(serviceSupplies?.map(ss => ss.service_id) || [])

    const list = (services || []).map((s: any) => {
      // Use price directly from services table
      const price = s.price_cents || 0

      // Calculate variable cost from supplies (same logic as /api/services)
      const serviceSupplyItems = serviceSupplies?.filter(ss => ss.service_id === s.id) || []
      const variableCost = serviceSupplyItems.reduce((total, ss) => {
        const supply = supplies?.find(sup => sup.id === ss.supply_id)
        const qty = ss.qty || 0  // Field is 'qty' not 'quantity'
        const supplyPrice = supply?.price_cents || 0
        const portions = supply?.portions || 0

        if (supply && portions > 0 && qty > 0) {
          const costPerPortion = supplyPrice / portions
          return total + Math.round(costPerPortion * qty)
        }
        return total
      }, 0)

      // Calculate fixed cost for this service
      const estMinutes = s.est_minutes || 0
      const fixedCost = Math.round(estMinutes * fixedCostPerMinuteCents)

      // Calculate total cost (fixed + variable) - same as /api/services
      const totalCost = fixedCost + variableCost

      // IMPORTANT: margin_pct in the app is actually MARKUP, not margin!
      // Formula: (Price - Cost) / Cost × 100 (NOT (Price - Cost) / Price)
      // This matches calculateRequiredMargin in lib/calc/tarifa.ts
      const markup = totalCost > 0 ? ((price - totalCost) / totalCost) * 100 : 0

      // Debug logging
      console.log(`[ClinicSnapshotService] Service "${s.name}":`, {
        price_cents: price,
        fixed_cost_cents: fixedCost,
        variable_cost_cents: variableCost,
        total_cost_cents: totalCost,
        markup_pct: Math.round(markup * 100) / 100,
        has_price: price > 0,
        is_active: s.is_active,
        supplies_count: serviceSupplyItems.length,
      })

      return {
        id: s.id,
        name: s.name,
        est_minutes: s.est_minutes,
        fixed_cost_cents: fixedCost,
        variable_cost_cents: variableCost,
        total_cost_cents: totalCost,
        current_price_cents: price,
        margin_pct: Math.round(markup * 100) / 100,  // Called margin_pct but it's actually markup
        has_pricing: price > 0 && s.is_active, // Has price configured and is active
      }
    })

    const withPricing = list.filter(s => s.has_pricing).length

    // Summary log for debugging
    console.log('[ClinicSnapshotService] Services summary:', {
      total: services?.length || 0,
      with_pricing: withPricing,
      with_supplies: servicesWithSupplies.size,
      pricing: list.map(s => ({ name: s.name, has_price: s.has_pricing, price: s.current_price_cents, variable_cost: s.variable_cost_cents }))
    })

    return {
      total_configured: services?.length || 0,
      with_pricing: withPricing,
      with_supplies: servicesWithSupplies.size,
      list,
    }
  }

  private async loadSupplies(supabase: SupabaseClient, clinicId: string) {
    let supplies: any[] | null
    let linkedToServices: number | null

    if (shouldReturnConvexData('supplies')) {
      supplies = stripConvexRows(
        (await listConvexDocumentsByClinic('supplies', clinicId)) as Record<string, any>[]
      )

      // Count service_supplies rows whose supply_id belongs to this clinic's supplies
      const supplyIds = new Set((supplies || []).map((s) => String(s.id)))
      linkedToServices = stripConvexRows(
        (await listConvexTable('service_supplies')) as Record<string, any>[]
      ).filter((ss) => ss.supply_id != null && supplyIds.has(String(ss.supply_id))).length
    } else {
      const { data: suppliesData } = await supabase
        .from('supplies')
        .select('id, name, price_cents, category')
        .eq('clinic_id', clinicId)
      supplies = suppliesData

      // Count how many are linked to services
      const { count } = await supabase
        .from('service_supplies')
        .select('supply_id', { count: 'exact', head: true })
        .in(
          'supply_id',
          supplies?.map((s) => s.id) || []
        )
      linkedToServices = count ?? null
    }

    const totalValue =
      supplies?.reduce((sum, s) => sum + (s.price_cents || 0), 0) || 0

    // Group by category
    const byCategory = (supplies || []).reduce(
      (acc, s) => {
        const cat = s.category || 'other'
        acc[cat] = (acc[cat] || 0) + (s.price_cents || 0)
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total_items: supplies?.length || 0,
      total_value_cents: totalValue,
      by_category: byCategory,
      linked_to_services: linkedToServices || 0,
    }
  }

  private async loadAssets(supabase: SupabaseClient, clinicId: string) {
    let assets: any[] | null

    if (shouldReturnConvexData('assets')) {
      assets = stripConvexRows(
        (await listConvexDocumentsByClinic('assets', clinicId)) as Record<string, any>[]
      )
    } else {
      const { data } = await supabase
        .from('assets')
        .select('id, name, purchase_price_cents, depreciation_months, purchase_date')
        .eq('clinic_id', clinicId)
      assets = data
    }

    const totalPurchaseValue =
      assets?.reduce((sum, a) => sum + (a.purchase_price_cents || 0), 0) || 0

    const items = (assets || []).map((a) => {
      // Simple straight-line depreciation: purchase_price / months
      const purchasePriceCents = a.purchase_price_cents || 0
      const months = a.depreciation_months || 1
      const monthlyDep = Math.round(purchasePriceCents / months)

      return {
        name: a.name,
        monthly_depreciation_cents: monthlyDep,
      }
    })

    const totalMonthlyDep = items.reduce(
      (sum, i) => sum + i.monthly_depreciation_cents,
      0
    )

    return {
      total_count: assets?.length || 0,
      total_purchase_value_cents: totalPurchaseValue,
      monthly_depreciation_cents: totalMonthlyDep,
      items,
    }
  }

  private async loadExpenses(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    let expenses: any[] | null

    if (shouldReturnConvexData('expenses')) {
      const startIso = startDate.toISOString()
      expenses = stripConvexRows(
        (await listConvexDocumentsByClinic('expenses', clinicId)) as Record<string, any>[]
      ).filter((e) => e.expense_date && String(e.expense_date) >= startIso)
    } else {
      const { data } = await supabase
        .from('expenses')
        .select('id, amount_cents, expense_date, category, description')
        .eq('clinic_id', clinicId)
        .gte('expense_date', startDate.toISOString())
      expenses = data
    }

    const total = expenses?.reduce((sum, e) => sum + (e.amount_cents || 0), 0) || 0

    // Group by category
    const byCategory = (expenses || []).reduce(
      (acc, e) => {
        const cat = e.category || 'other'
        acc[cat] = (acc[cat] || 0) + (e.amount_cents || 0)
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total_in_period_cents: total,
      count: expenses?.length || 0,
      by_category: byCategory,
    }
  }

  private async loadLeads(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    let totalLeads: number | null
    let convertedTotal: number | null
    let leadsInPeriod: any[] | null
    let recentLeads: any[] | null

    if (shouldReturnConvexData('leads')) {
      const startIso = startDate.toISOString()
      const allLeads = stripConvexRows(
        (await listConvexDocumentsByClinic('leads', clinicId)) as Record<string, any>[]
      )

      // Resolve marketing_campaigns(id, name) join manually via id -> campaign map
      const campaigns = stripConvexRows(
        (await listConvexDocumentsByClinic('marketing_campaigns', clinicId)) as Record<string, any>[]
      )
      const campaignById = new Map(campaigns.map((c) => [String(c.id), { id: c.id, name: c.name }]))
      const withCampaign = (lead: Record<string, any>) => ({
        ...lead,
        marketing_campaigns: lead.campaign_id ? campaignById.get(String(lead.campaign_id)) ?? null : null,
      })

      totalLeads = allLeads.length

      // .or('status.eq.converted,converted_patient_id.not.is.null')
      convertedTotal = allLeads.filter(
        (l) => l.status === 'converted' || (l.converted_patient_id != null)
      ).length

      leadsInPeriod = allLeads
        .filter((l) => l.created_at && String(l.created_at) >= startIso)
        .map(withCampaign)

      recentLeads = [...allLeads]
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
        .slice(0, 50)
        .map(withCampaign)
    } else {
      const { count: total } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
      totalLeads = total ?? null

      const { count: converted } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .or('status.eq.converted,converted_patient_id.not.is.null')
      convertedTotal = converted ?? null

      const { data: periodData } = await supabase
        .from('leads')
        .select('id, status, campaign_id, converted_patient_id, converted_at, created_at, marketing_campaigns(id, name)')
        .eq('clinic_id', clinicId)
        .gte('created_at', startDate.toISOString())
      leadsInPeriod = periodData

      const { data: recentData } = await supabase
        .from('leads')
        .select('id, full_name, email, phone, status, created_at, converted_at, converted_patient_id, campaign_id, marketing_campaigns(id, name)')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(50)
      recentLeads = recentData
    }

    const byStatus = (leadsInPeriod || []).reduce(
      (acc, lead: any) => {
        const status = lead.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const byCampaign = (leadsInPeriod || []).reduce(
      (acc, lead: any) => {
        const name = lead.marketing_campaigns?.name || 'unknown'
        acc[name] = (acc[name] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const newInPeriod = leadsInPeriod?.length || 0
    const convertedInPeriod = (leadsInPeriod || []).filter(
      (lead: any) => lead.status === 'converted' || lead.converted_patient_id
    ).length
    const conversionRate = newInPeriod > 0 ? (convertedInPeriod / newInPeriod) * 100 : 0

    const recent = (recentLeads || []).map((lead: any) => ({
      id: lead.id,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      created_at: lead.created_at,
      converted_at: lead.converted_at,
      converted_patient_id: lead.converted_patient_id,
      campaign_id: lead.campaign_id,
      campaign_name: lead.marketing_campaigns?.name || null,
    }))

    return {
      total: totalLeads || 0,
      converted_total: convertedTotal || 0,
      new_in_period: newInPeriod,
      converted_in_period: convertedInPeriod,
      conversion_rate_pct: Math.round(conversionRate * 100) / 100,
      by_status: byStatus,
      by_campaign: byCampaign,
      recent,
    }
  }

  private async loadInboxConversations(supabase: SupabaseClient, clinicId: string) {
    let statusRows: any[] | null
    let recent: any[] | null

    if (shouldReturnConvexData('inbox_conversations')) {
      const conversations = stripConvexRows(
        (await listConvexDocumentsByClinic('inbox_conversations', clinicId)) as Record<string, any>[]
      )
      statusRows = conversations.map((c) => ({ status: c.status }))

      // ORDER BY last_message_at DESC NULLS LAST, created_at DESC; LIMIT 50
      recent = [...conversations]
        .sort((a, b) => {
          const aHas = a.last_message_at != null
          const bHas = b.last_message_at != null
          if (aHas !== bHas) return aHas ? -1 : 1 // non-null first (NULLS LAST)
          if (aHas && bHas) {
            const cmp = String(b.last_message_at).localeCompare(String(a.last_message_at))
            if (cmp !== 0) return cmp
          }
          return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        })
        .slice(0, 50)
        .map((c) => ({
          id: c.id,
          channel: c.channel,
          contact_name: c.contact_name,
          contact_address: c.contact_address,
          status: c.status,
          conversation_state: c.conversation_state,
          assigned_user_id: c.assigned_user_id,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          unread_count: c.unread_count,
          campaign_id: c.campaign_id,
          lead_id: c.lead_id,
          patient_id: c.patient_id,
          created_at: c.created_at,
        }))
    } else {
      const { data: statusData } = await supabase
        .from('inbox_conversations')
        .select('status')
        .eq('clinic_id', clinicId)
      statusRows = statusData

      const { data: recentData } = await supabase
        .from('inbox_conversations')
        .select(`
        id,
        channel,
        contact_name,
        contact_address,
        status,
        conversation_state,
        assigned_user_id,
        last_message_at,
        last_message_preview,
        unread_count,
        campaign_id,
        lead_id,
        patient_id,
        created_at
      `)
        .eq('clinic_id', clinicId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50)
      recent = recentData
    }

    const byStatus = (statusRows || []).reduce(
      (acc, row: any) => {
        const status = row.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const openCount = (statusRows || []).filter((row: any) => row.status !== 'closed').length
    const inProgressCount = (statusRows || []).filter((row: any) => row.status === 'in_progress').length

    return {
      total: statusRows?.length || 0,
      open_count: openCount,
      in_progress_count: inProgressCount,
      by_status: byStatus,
      recent: recent || [],
    }
  }

  private async loadInboxMessages(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    let recent: any[]

    if (shouldReturnConvexData('inbox_messages')) {
      const startIso = startDate.toISOString()
      // Indirect: inbox_messages joins inbox_conversations on clinic_id.
      // Resolve this clinic's conversation ids, then filter messages by FK.
      const conversations = stripConvexRows(
        (await listConvexDocumentsByClinic('inbox_conversations', clinicId)) as Record<string, any>[]
      )
      const conversationIds = new Set(conversations.map((c) => String(c.id)))

      recent = stripConvexRows(
        (await listConvexTable('inbox_messages')) as Record<string, any>[]
      )
        .filter(
          (m) =>
            m.conversation_id != null &&
            conversationIds.has(String(m.conversation_id)) &&
            m.created_at &&
            String(m.created_at) >= startIso
        )
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
        .slice(0, 200)
        .map((m) => ({
          id: m.id,
          conversation_id: m.conversation_id,
          role: m.role,
          direction: m.direction,
          content: m.content,
          message_type: m.message_type,
          created_at: m.created_at,
        }))
    } else {
      const { data: messages } = await supabase
        .from('inbox_messages')
        .select(`
        id,
        conversation_id,
        role,
        direction,
        content,
        message_type,
        created_at,
        inbox_conversations!inner(clinic_id)
      `)
        .eq('inbox_conversations.clinic_id', clinicId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      recent = (messages || []).map((message: any) => {
        const { inbox_conversations, ...rest } = message
        return rest
      })
    }

    return {
      total_in_period: recent.length,
      recent,
    }
  }

  private async loadFullPatients(
    supabase: SupabaseClient,
    clinicId: string
  ) {
    if (shouldReturnConvexData('patients')) {
      // Load all patients with complete information including notes
      return stripConvexRows(
        (await listConvexDocumentsByClinic('patients', clinicId)) as Record<string, any>[]
      )
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
        .slice(0, 100) // Limit to most recent 100 patients to avoid overwhelming the AI
        .map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          email: p.email,
          notes: p.notes,
          created_at: p.created_at,
          first_visit_date: p.first_visit_date,
        }))
    }

    // Load all patients with complete information including notes
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, last_name, phone, email, notes, created_at, first_visit_date')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(100) // Limit to most recent 100 patients to avoid overwhelming the AI

    return patients || []
  }

  private async loadFullTreatments(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    let treatments: any[] | null

    if (shouldReturnConvexData('treatments')) {
      const startIso = startDate.toISOString()
      // Resolve patients!inner + services!inner joins manually via id -> row maps
      const patients = stripConvexRows(
        (await listConvexDocumentsByClinic('patients', clinicId)) as Record<string, any>[]
      )
      const patientById = new Map(patients.map((p) => [String(p.id), p]))
      const services = stripConvexRows(
        (await listConvexDocumentsByClinic('services', clinicId)) as Record<string, any>[]
      )
      const serviceNameById = new Map(services.map((s) => [String(s.id), s.name]))

      treatments = stripConvexRows(
        (await listConvexDocumentsByClinic('treatments', clinicId)) as Record<string, any>[]
      )
        // !inner joins => require a matching patient AND service
        .filter(
          (t) =>
            t.treatment_date &&
            String(t.treatment_date) >= startIso &&
            t.patient_id != null &&
            patientById.has(String(t.patient_id)) &&
            t.service_id != null &&
            serviceNameById.has(String(t.service_id))
        )
        // ORDER BY treatment_date DESC, treatment_time ASC
        .sort((a, b) => {
          const dateCmp = String(b.treatment_date).localeCompare(String(a.treatment_date))
          if (dateCmp !== 0) return dateCmp
          return String(a.treatment_time ?? '').localeCompare(String(b.treatment_time ?? ''))
        })
        .map((t) => {
          const patient = patientById.get(String(t.patient_id))
          return {
            id: t.id,
            treatment_date: t.treatment_date,
            treatment_time: t.treatment_time,
            price_cents: t.price_cents,
            status: t.status,
            notes: t.notes,
            duration_minutes: t.duration_minutes,
            tooth_number: t.tooth_number,
            is_paid: t.is_paid,
            patients: { first_name: patient?.first_name, last_name: patient?.last_name },
            services: { name: serviceNameById.get(String(t.service_id)) },
          }
        })
    } else {
      // Load all treatments in period with complete information including notes and TIME
      const { data } = await supabase
        .from('treatments')
        .select(`
        id,
        treatment_date,
        treatment_time,
        price_cents,
        status,
        notes,
        duration_minutes,
        tooth_number,
        is_paid,
        patients!inner(first_name, last_name),
        services!inner(name)
      `)
        .eq('clinic_id', clinicId)
        .gte('treatment_date', startDate.toISOString())
        .order('treatment_date', { ascending: false })
        .order('treatment_time', { ascending: true })
      treatments = data
    }

    return (treatments || []).map(t => ({
      id: t.id,
      date: t.treatment_date,
      time: t.treatment_time || null, // CRITICAL: Include appointment time
      patient: `${(t.patients as any).first_name} ${(t.patients as any).last_name}`,
      service: (t.services as any).name,
      price_cents: t.price_cents,
      duration_minutes: t.duration_minutes,
      status: t.status,
      tooth_number: t.tooth_number || null, // Dental context
      is_paid: t.is_paid || false,
      notes: t.notes || null,
    }))
  }

  private async loadFixedCosts(supabase: SupabaseClient, clinicId: string) {
    let fixedCosts: any[] | null

    if (shouldReturnConvexData('fixed_costs')) {
      fixedCosts = stripConvexRows(
        (await listConvexDocumentsByClinic('fixed_costs', clinicId)) as Record<string, any>[]
      )
    } else {
      const { data } = await supabase
        .from('fixed_costs')
        .select('id, concept, amount_cents')
        .eq('clinic_id', clinicId)
      fixedCosts = data
    }

    const manualTotal =
      fixedCosts?.reduce((sum, fc) => sum + (fc.amount_cents || 0), 0) || 0

    const items = (fixedCosts || []).map((fc) => ({
      name: fc.concept,
      amount_cents: fc.amount_cents,
      type: 'manual' as const,
    }))

    return {
      monthly_total_cents: manualTotal,
      includes_depreciation: false, // Will add later in analytics
      items,
    }
  }

  // ==========================================================================
  // Analytics Calculator
  // ==========================================================================

  private calculateAnalytics(data: any) {
    const { clinic, treatments, services, assets, expenses, fixedCosts, leads, period } = data

    // Calculate total fixed costs (manual + depreciation)
    const manualFixedCosts = fixedCosts.monthly_total_cents
    const depreciationCosts = assets.monthly_depreciation_cents
    const totalFixedCosts = manualFixedCosts + depreciationCosts

    const totalRevenue = treatments.total_revenue_cents
    const totalExpenses = expenses.total_in_period_cents

    // Calculate average variable cost percentage FROM SERVICES (not expenses)
    // This is the CORRECT way: variable costs are materials/supplies, not all expenses
    let totalVariableCosts = 0
    let totalPrices = 0

    if (treatments.by_service && treatments.by_service.length > 0) {
      // Use actual treatment data with service variable costs
      for (const treatmentService of treatments.by_service) {
        const service = services.list.find((s: any) => s.name === treatmentService.service_name)
        if (service) {
          totalVariableCosts += service.variable_cost_cents * treatmentService.count
          totalPrices += service.current_price_cents * treatmentService.count
        }
      }
    } else {
      // No treatments yet - use service configuration
      for (const service of services.list) {
        totalVariableCosts += service.variable_cost_cents
        totalPrices += service.current_price_cents
      }
    }

    // Calculate average variable cost percentage
    const avgVariableCostPct =
      totalPrices > 0 ? (totalVariableCosts / totalPrices) * 100 : 0

    // Contribution margin (what's left after variable costs to cover fixed costs)
    const contributionMarginPct = 100 - avgVariableCostPct

    // Break-even calculation using CORRECT formula
    // Break-even Revenue = Fixed Costs ÷ Contribution Margin
    const breakEvenRevenue =
      contributionMarginPct > 0
        ? (totalFixedCosts / (contributionMarginPct / 100))
        : 0

    // CRITICAL FIX: Determine correct price source for treatment calculations
    // Problem: mixing historical treatment prices with configured service prices creates inconsistency
    const MINIMUM_TREATMENTS_FOR_RELIABLE_HISTORY = 10
    const hasEnoughTreatmentHistory = treatments.total_in_period >= MINIMUM_TREATMENTS_FOR_RELIABLE_HISTORY

    let avgTreatmentPrice: number
    let priceDataSource: 'historical' | 'configured' | 'none'
    let calculationWarning: string | null = null

    if (hasEnoughTreatmentHistory) {
      // Sufficient history - use actual average from treatments
      avgTreatmentPrice = treatments.avg_price_cents
      priceDataSource = 'historical'
    } else {
      // Insufficient history - calculate average from configured service prices
      const servicesWithPricing = services.list.filter((s: any) => s.has_pricing)

      if (servicesWithPricing.length > 0) {
        avgTreatmentPrice = Math.round(
          servicesWithPricing.reduce((sum: number, s: any) => sum + s.current_price_cents, 0) /
          servicesWithPricing.length
        )
        priceDataSource = 'configured'
        calculationWarning = treatments.total_in_period > 0
          ? `Using average of ${servicesWithPricing.length} configured service prices due to insufficient treatment history (only ${treatments.total_in_period} treatments recorded)`
          : `Using average of ${servicesWithPricing.length} configured service prices (no treatments recorded yet)`
      } else {
        // No pricing data available at all
        avgTreatmentPrice = 0
        priceDataSource = 'none'
        calculationWarning = 'No pricing data available - configure service prices in the Services module'
      }
    }

    const breakEvenTreatments =
      avgTreatmentPrice > 0 ? Math.ceil(breakEvenRevenue / avgTreatmentPrice) : 0

    const currentTreatments = treatments.total_in_period
    const gap = breakEvenTreatments - currentTreatments
    const status =
      currentTreatments >= breakEvenTreatments
        ? 'above'
        : currentTreatments === breakEvenTreatments
          ? 'at'
          : 'below'

    // Net profit using REAL expenses from the period (not projected costs)
    // totalExpenses already includes all real costs (materials, rent, utilities, etc.)
    const netProfit = totalRevenue - totalExpenses
    const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // Efficiency metrics
    const daysInPeriod = period
    const treatmentsPerDay =
      daysInPeriod > 0 ? currentTreatments / daysInPeriod : 0
    const revenuePerHour =
      clinic.time_settings.work_days * clinic.time_settings.hours_per_day > 0
        ? totalRevenue /
        (clinic.time_settings.work_days *
          clinic.time_settings.hours_per_day)
        : 0

    // Capacity utilization
    const totalMinutesUsed =
      services.list.reduce((sum: number, s: any) => {
        const serviceStats = treatments.by_service.find(
          (ts: any) => ts.service_name === s.name
        )
        return sum + (serviceStats?.count || 0) * (s.est_minutes || 0)
      }, 0) || 0

    const availableMinutes = clinic.time_settings.available_treatment_minutes
    const capacityUtilization =
      availableMinutes > 0 ? (totalMinutesUsed / availableMinutes) * 100 : 0

    // Wasted minutes and opportunity cost
    const wastedMinutes = Math.max(0, availableMinutes - totalMinutesUsed)
    // Calculate opportunity cost using average revenue per minute
    const totalRevenueCents = treatments.total_revenue_cents || 0
    const avgRevenuePerMinute = totalMinutesUsed > 0 && totalRevenueCents > 0
      ? totalRevenueCents / totalMinutesUsed
      : 0
    // Opportunity cost = wasted time × avg revenue per minute (potential revenue lost)
    // Round to integer cents (money must always be stored as integer cents)
    const opportunityCostCents = Math.round(wastedMinutes * avgRevenuePerMinute)

    // Top performers
    const sortedByMargin = [...services.list].sort((a, b) => b.margin_pct - a.margin_pct)
    const sortedByRevenue = [...treatments.by_service].sort(
      (a, b) => b.revenue_cents - a.revenue_cents
    )
    const sortedByFrequency = [...treatments.by_service].sort(
      (a, b) => b.count - a.count
    )

    return {
      break_even: {
        revenue_cents: Math.round(breakEvenRevenue),
        treatments_needed: Math.round(breakEvenTreatments),
        current_treatments: currentTreatments,
        gap: Math.round(gap),
        status,
        calculation_metadata: {
          avg_treatment_price_cents: Math.round(avgTreatmentPrice),
          price_data_source: priceDataSource,
          historical_treatments_count: treatments.total_in_period,
          configured_services_count: services.total_configured,
          services_with_pricing_count: services.list.filter((s: any) => s.has_pricing).length,
          warning: calculationWarning,
        },
      },
      leads: {
        total: leads?.total || 0,
        new_in_period: leads?.new_in_period || 0,
        converted_in_period: leads?.converted_in_period || 0,
        conversion_rate_pct: leads?.conversion_rate_pct || 0,
        by_status: leads?.by_status || {},
        by_campaign: leads?.by_campaign || {},
      },
      margins: {
        avg_variable_cost_pct: Math.round(avgVariableCostPct * 100) / 100,
        contribution_margin_pct: Math.round(contributionMarginPct * 100) / 100,
        gross_margin_pct: Math.round(contributionMarginPct * 100) / 100, // Same as contribution for now
        net_margin_pct: Math.round(profitMarginPct * 100) / 100,
      },
      profitability: {
        net_profit_cents: Math.round(netProfit),
        profit_margin_pct: Math.round(profitMarginPct * 100) / 100,
      },
      efficiency: {
        treatments_per_day: Math.round(treatmentsPerDay * 100) / 100,
        revenue_per_hour_cents: Math.round(revenuePerHour),
        capacity_utilization_pct: Math.round(capacityUtilization * 100) / 100,
        total_available_minutes: availableMinutes,
        total_used_minutes: Math.round(totalMinutesUsed),
        wasted_minutes: Math.round(wastedMinutes),
        opportunity_cost_cents: Math.round(opportunityCostCents),
      },
      top_performers: {
        most_profitable_service: sortedByMargin[0]?.name || 'N/A',
        most_revenue_service: sortedByRevenue[0]?.service_name || 'N/A',
        most_frequent_service: sortedByFrequency[0]?.service_name || 'N/A',
      },
    }
  }

  // ==========================================================================
  // App Schema
  // ==========================================================================

  private getAppSchema(): AppSchema {
    return {
      version: '1.0',
      modules: {
        patients: {
          description: 'Patient management - stores all clinic patients',
          key_fields: ['name', 'email', 'phone', 'source', 'created_at'],
          relationships: ['Has many treatments'],
        },
        leads: {
          description: 'Inbound leads captured before becoming patients',
          key_fields: ['full_name', 'phone', 'status', 'campaign_id', 'created_at'],
          relationships: ['May convert to patients', 'Linked to inbox_conversations'],
        },
        inbox_conversations: {
          description: 'Inbound/outbound conversation threads (WhatsApp, phone, web)',
          key_fields: ['contact_address', 'status', 'assigned_user_id', 'last_message_at'],
          relationships: ['Has many inbox_messages', 'Belongs to lead/patient', 'Belongs to campaign'],
        },
        inbox_messages: {
          description: 'Messages exchanged inside inbox conversations',
          key_fields: ['conversation_id', 'direction', 'role', 'content', 'created_at'],
          relationships: ['Belongs to inbox_conversations'],
        },
        marketing_campaign_channels: {
          description: 'Channel routing for campaigns (WhatsApp numbers, phone lines)',
          key_fields: ['campaign_id', 'channel_type', 'channel_address', 'is_active'],
          relationships: ['Belongs to marketing_campaigns'],
        },
        treatments: {
          description:
            'Individual patient appointments - generates revenue from services',
          key_fields: [
            'patient_id',
            'service_id',
            'treatment_date',
            'price_cents',
            'snapshot_costs',
          ],
          relationships: ['Belongs to patient', 'Belongs to service'],
        },
        services: {
          description: 'Procedures offered by the clinic with integrated pricing (cleaning, filling, etc.)',
          key_fields: ['name', 'est_minutes', 'variable_cost_cents', 'price_cents', 'margin_pct'],
          relationships: ['Has many service_supplies', 'Used in treatments'],
        },
        supplies: {
          description: 'Materials used in treatments (amalgam, cement, etc.)',
          key_fields: ['name', 'price_cents', 'portions', 'category'],
          relationships: ['Used in services via service_supplies'],
        },
        service_supplies: {
          description: 'Links services to supplies - defines recipes',
          key_fields: ['service_id', 'supply_id', 'quantity'],
          relationships: ['Belongs to service', 'Belongs to supply'],
        },
        assets: {
          description: 'Equipment that depreciates monthly (chair, drill, etc.)',
          key_fields: [
            'name',
            'purchase_price_pesos',
            'depreciation_months',
            'purchase_date',
          ],
          relationships: ['Contributes to fixed costs via depreciation'],
        },
        fixed_costs: {
          description: 'Recurring monthly expenses (rent, salary, etc.)',
          key_fields: ['name', 'monthly_cost_cents'],
          relationships: ['Used in break-even calculation'],
        },
        expenses: {
          description: 'Operational expenses tracked by date',
          key_fields: ['amount_cents', 'expense_date', 'category', 'description'],
          relationships: ['Reduces profitability'],
        },
        tariffs: {
          description: '[DEPRECATED] Historical pricing table - use services.price_cents instead',
          key_fields: ['service_id', 'price_cents', 'created_at'],
          relationships: ['[Read-only] Belongs to service (for audit only)'],
        },
      },
      business_formulas: {
        variable_cost:
          'Sum of (supply.price_cents × service_supply.quantity) for all supplies in service',
        treatment_price: '(fixed_cost_per_minute × minutes + variable_cost) × (1 + margin%)',
        contribution_margin: '1 - (Variable Costs ÷ Total Revenue)',
        break_even_revenue: 'Total Monthly Fixed Costs ÷ Contribution Margin',
        break_even_treatments: 'Break-even Revenue ÷ Average Treatment Price',
        net_profit: 'Total Revenue - Total Expenses - Total Fixed Costs',
        profit_margin: '(Net Profit ÷ Total Revenue) × 100',
        capacity_utilization:
          '(Total Minutes Used ÷ Available Treatment Minutes) × 100',
        depreciation: 'Purchase Price ÷ Depreciation Months (prorated if mid-month)',
        lead_conversion_rate: 'Converted Leads / Total Leads * 100',
      },
    }
  }

  // ==========================================================================
  // JSON Optimizer
  // ==========================================================================

  private optimizeJson(data: any): any {
    if (data === null || data === undefined) {
      return undefined
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.optimizeJson(item)).filter((item) => item !== undefined)
    }

    if (typeof data === 'object') {
      const optimized: any = {}
      for (const [key, value] of Object.entries(data)) {
        const optimizedValue = this.optimizeJson(value)
        if (optimizedValue !== undefined) {
          optimized[key] = optimizedValue
        }
      }
      return Object.keys(optimized).length > 0 ? optimized : undefined
    }

    if (typeof data === 'number') {
      // Round to 2 decimals if it's a decimal number
      return Number.isInteger(data) ? data : Math.round(data * 100) / 100
    }

    return data
  }
}
