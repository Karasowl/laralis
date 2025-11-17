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

// ============================================================================
// Types
// ============================================================================

interface SnapshotOptions {
  period?: number // Days to look back (default: 30)
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
  work_days_per_month: number
  hours_per_day: number
  real_productivity_pct: number
  available_treatment_minutes: number
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
  }
  analytics: {
    break_even: any
    margins: any
    profitability: any
    efficiency: any
    top_performers: any
  }
}

// ============================================================================
// Service
// ============================================================================

export class ClinicSnapshotService {
  /**
   * Generate complete clinic snapshot with all data and pre-computed analytics
   */
  async getFullSnapshot(
    supabase: SupabaseClient,
    clinicId: string,
    options: SnapshotOptions = {}
  ): Promise<FullClinicSnapshot> {
    const period = options.period || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)

    // Load clinic info first (needed for calculations)
    const clinic = await this.loadClinicInfo(supabase, clinicId)

    // Load all data in parallel
    const [patients, treatments, services, supplies, assets, expenses, fixedCosts] =
      await Promise.all([
        this.loadPatients(supabase, clinicId, startDate),
        this.loadTreatments(supabase, clinicId, startDate),
        this.loadServices(supabase, clinicId),
        this.loadSupplies(supabase, clinicId),
        this.loadAssets(supabase, clinicId),
        this.loadExpenses(supabase, clinicId, startDate),
        this.loadFixedCosts(supabase, clinicId),
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
      },
      analytics: this.optimizeJson(analytics),
    }

    return snapshot
  }

  // ==========================================================================
  // Data Loaders
  // ==========================================================================

  private async loadClinicInfo(supabase: SupabaseClient, clinicId: string) {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('id', clinicId)
      .single()

    const { data: timeSettings } = await supabase
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .single()

    // Calculate available treatment minutes
    const workDays = timeSettings?.work_days_per_month || 22
    const hoursPerDay = timeSettings?.hours_per_day || 8
    const realPct = (timeSettings?.real_pct || 80) / 100
    const availableMinutes = workDays * hoursPerDay * 60 * realPct

    return {
      id: clinic?.id || clinicId,
      name: clinic?.name || 'Unknown Clinic',
      time_settings: {
        work_days_per_month: workDays,
        hours_per_day: hoursPerDay,
        real_productivity_pct: timeSettings?.real_pct || 80,
        available_treatment_minutes: Math.round(availableMinutes),
      },
    }
  }

  private async loadPatients(
    supabase: SupabaseClient,
    clinicId: string,
    startDate: Date
  ) {
    // Total patients
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    // New patients in period with source information
    const { data: newPatients } = await supabase
      .from('patients')
      .select('id, created_at, source_id, patient_sources(name)')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())

    // Active patients (with treatments in period)
    const { data: activeTreatments } = await supabase
      .from('treatments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', startDate.toISOString())

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
    const { data: treatments } = await supabase
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

    const total = treatments?.length || 0
    const totalRevenue =
      treatments?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0
    const avgPrice = total > 0 ? totalRevenue / total : 0

    // Group by service
    const byService = (treatments || []).reduce(
      (acc, t) => {
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

  private async loadServices(supabase: SupabaseClient, clinicId: string) {
    // Get all services with their current tariffs
    const { data: services } = await supabase
      .from('services')
      .select(
        `
        id,
        name,
        est_minutes,
        variable_cost_cents,
        tariffs!inner(price_cents)
      `
      )
      .eq('clinic_id', clinicId)
      .order('name')

    // Count services with supplies
    const { count: withSupplies } = await supabase
      .from('service_supplies')
      .select('service_id', { count: 'exact', head: true })
      .in(
        'service_id',
        services?.map((s) => s.id) || []
      )

    const list = (services || []).map((s: any) => {
      const price = s.tariffs?.price_cents || 0
      const variableCost = s.variable_cost_cents || 0
      const margin = price > 0 ? ((price - variableCost) / price) * 100 : 0

      return {
        id: s.id,
        name: s.name,
        est_minutes: s.est_minutes,
        variable_cost_cents: variableCost,
        current_price_cents: price,
        margin_pct: Math.round(margin * 100) / 100,
      }
    })

    return {
      total_configured: services?.length || 0,
      with_supplies: withSupplies || 0,
      list,
    }
  }

  private async loadSupplies(supabase: SupabaseClient, clinicId: string) {
    const { data: supplies } = await supabase
      .from('supplies')
      .select('id, name, price_cents, category')
      .eq('clinic_id', clinicId)

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

    // Count how many are linked to services
    const { count: linkedToServices } = await supabase
      .from('service_supplies')
      .select('supply_id', { count: 'exact', head: true })
      .in(
        'supply_id',
        supplies?.map((s) => s.id) || []
      )

    return {
      total_items: supplies?.length || 0,
      total_value_cents: totalValue,
      by_category: byCategory,
      linked_to_services: linkedToServices || 0,
    }
  }

  private async loadAssets(supabase: SupabaseClient, clinicId: string) {
    const { data: assets } = await supabase
      .from('assets')
      .select('id, name, purchase_price_cents, depreciation_months, purchase_date')
      .eq('clinic_id', clinicId)

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
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount_cents, expense_date, category, description')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDate.toISOString())

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

  private async loadFixedCosts(supabase: SupabaseClient, clinicId: string) {
    const { data: fixedCosts } = await supabase
      .from('fixed_costs')
      .select('id, concept, amount_cents')
      .eq('clinic_id', clinicId)

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
    const { clinic, treatments, services, assets, expenses, fixedCosts, period } = data

    // Calculate total fixed costs (manual + depreciation)
    const manualFixedCosts = fixedCosts.monthly_total_cents
    const depreciationCosts = assets.monthly_depreciation_cents
    const totalFixedCosts = manualFixedCosts + depreciationCosts

    // Calculate average variable cost percentage
    const totalRevenue = treatments.total_revenue_cents
    const totalExpenses = expenses.total_in_period_cents

    // Approximate variable costs from expenses (this is a simplification)
    const avgVariableCostPct =
      totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

    // Contribution margin
    const contributionMarginPct = 100 - avgVariableCostPct

    // Break-even calculation
    const breakEvenRevenue =
      contributionMarginPct > 0
        ? (totalFixedCosts / contributionMarginPct) * 100
        : 0
    const avgTreatmentPrice = treatments.avg_price_cents
    const breakEvenTreatments =
      avgTreatmentPrice > 0 ? breakEvenRevenue / avgTreatmentPrice : 0

    const currentTreatments = treatments.total_in_period
    const gap = breakEvenTreatments - currentTreatments
    const status =
      currentTreatments >= breakEvenTreatments
        ? 'above'
        : currentTreatments === breakEvenTreatments
          ? 'at'
          : 'below'

    // Net profit
    const netProfit = totalRevenue - totalExpenses - totalFixedCosts
    const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // Efficiency metrics
    const daysInPeriod = period
    const treatmentsPerDay =
      daysInPeriod > 0 ? currentTreatments / daysInPeriod : 0
    const revenuePerHour =
      clinic.time_settings.work_days_per_month * clinic.time_settings.hours_per_day > 0
        ? totalRevenue /
          (clinic.time_settings.work_days_per_month *
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
          description: 'Procedures offered by the clinic (cleaning, filling, etc.)',
          key_fields: ['name', 'minutes', 'variable_cost_cents'],
          relationships: ['Has many service_supplies', 'Has many tariffs'],
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
          description: 'Pricing for services - can change over time',
          key_fields: ['service_id', 'price_cents', 'created_at'],
          relationships: ['Belongs to service'],
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
