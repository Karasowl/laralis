/**
 * Operational Actions for Lara AI
 *
 * Actions that modify data or provide operational insights.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionParams, ActionResult } from '../types'

interface ActionContext {
  supabase: SupabaseClient
  clinicId: string
  userId: string
  dryRun?: boolean
}

// Helper to format cents as currency string
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Helper to get date N days ago
function getDateDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

/**
 * Bulk update prices
 */
export async function executeBulkUpdatePrices(
  params: ActionParams['bulk_update_prices'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId, dryRun } = context
  const { change_type, change_value, service_ids, category } = params

  try {
    // Get services to update
    let query = supabase.from('services').select('id, name, price_cents, category').eq('clinic_id', clinicId)

    if (service_ids && service_ids.length > 0) {
      query = query.in('id', service_ids)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: services, error } = await query

    if (error || !services || services.length === 0) {
      return {
        success: false,
        action: 'bulk_update_prices',
        params,
        error: { code: 'NO_SERVICES', message: 'No services found matching criteria' },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Calculate new prices
    const updates = services.map(s => {
      let newPrice: number
      if (change_type === 'percentage') {
        newPrice = Math.round(s.price_cents * (1 + change_value / 100))
      } else {
        newPrice = s.price_cents + change_value
      }
      return {
        id: s.id,
        name: s.name,
        old_price_cents: s.price_cents,
        new_price_cents: Math.max(0, newPrice), // Don't allow negative prices
        change_cents: newPrice - s.price_cents,
      }
    })

    const totalOld = updates.reduce((sum, u) => sum + u.old_price_cents, 0)
    const totalNew = updates.reduce((sum, u) => sum + u.new_price_cents, 0)

    const changes = [
      `💰 Bulk Price Update (${change_type === 'percentage' ? `${change_value}%` : formatCurrency(change_value)})`,
      `Services affected: ${updates.length}`,
      '',
    ]

    updates.forEach(u => {
      const arrow = u.change_cents > 0 ? '↑' : u.change_cents < 0 ? '↓' : '→'
      changes.push(`${u.name}: ${formatCurrency(u.old_price_cents)} ${arrow} ${formatCurrency(u.new_price_cents)}`)
    })

    changes.push('', `**Total impact:** ${formatCurrency(totalOld)} → ${formatCurrency(totalNew)}`)

    if (dryRun) {
      changes.push('', '⚠️ DRY RUN - No changes made')
      return {
        success: true,
        action: 'bulk_update_prices',
        params,
        result: { changes, updates, dry_run: true },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Execute updates
    for (const u of updates) {
      await supabase
        .from('services')
        .update({ price_cents: u.new_price_cents, updated_at: new Date().toISOString() })
        .eq('id', u.id)
    }

    changes.push('', '✅ Prices updated successfully')

    return {
      success: true,
      action: 'bulk_update_prices',
      params,
      result: { changes, updates, services_updated: updates.length },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'bulk_update_prices',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Forecast revenue
 */
export async function executeForecastRevenue(
  params: ActionParams['forecast_revenue'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const days = params.days || 30
  const includeTrends = params.include_trends !== false

  try {
    // Get historical data (90 days for trend analysis)
    const startDate = getDateDaysAgo(90)

    const { data: treatments } = await supabase
      .from('treatments')
      .select('price_cents, treatment_date')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', startDate.toISOString())
      .order('treatment_date', { ascending: true })

    if (!treatments || treatments.length === 0) {
      return {
        success: true,
        action: 'forecast_revenue',
        params,
        result: {
          changes: ['📊 No historical data available for forecast'],
          forecast: { days, projected_revenue_cents: 0, confidence: 'low' },
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Group by week for trend analysis
    const weeklyRevenue: number[] = []
    let weekStart = new Date(treatments[0].treatment_date)
    let weekSum = 0

    treatments.forEach(t => {
      const tDate = new Date(t.treatment_date)
      const daysDiff = Math.floor((tDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))

      if (daysDiff >= 7) {
        weeklyRevenue.push(weekSum)
        weekStart = tDate
        weekSum = t.price_cents || 0
      } else {
        weekSum += t.price_cents || 0
      }
    })
    weeklyRevenue.push(weekSum)

    // Calculate average daily revenue
    const totalRevenue = treatments.reduce((sum, t) => sum + (t.price_cents || 0), 0)
    const actualDays = Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const avgDailyRevenue = totalRevenue / actualDays

    // Simple trend: compare last 30 days to previous 30 days
    const last30 = treatments.filter(t => new Date(t.treatment_date) >= getDateDaysAgo(30))
    const prev30 = treatments.filter(t => {
      const d = new Date(t.treatment_date)
      return d >= getDateDaysAgo(60) && d < getDateDaysAgo(30)
    })

    const last30Revenue = last30.reduce((sum, t) => sum + (t.price_cents || 0), 0)
    const prev30Revenue = prev30.reduce((sum, t) => sum + (t.price_cents || 0), 0)
    const growthRate = prev30Revenue > 0 ? ((last30Revenue - prev30Revenue) / prev30Revenue) * 100 : 0

    // Project future revenue
    const projectedDailyRevenue = avgDailyRevenue * (1 + growthRate / 100 / 12) // Moderate growth assumption
    const projectedRevenue = Math.round(projectedDailyRevenue * days)

    // Confidence based on data quality
    const confidence = treatments.length >= 50 ? 'high' : treatments.length >= 20 ? 'medium' : 'low'

    const changes = [
      `📈 Revenue Forecast (${days} days)`,
      '',
      `**Historical Analysis:**`,
      `  - Data points: ${treatments.length} treatments`,
      `  - Avg daily revenue: ${formatCurrency(Math.round(avgDailyRevenue))}`,
    ]

    if (includeTrends) {
      changes.push(
        '',
        `**Trend Analysis:**`,
        `  - Last 30 days: ${formatCurrency(last30Revenue)}`,
        `  - Previous 30 days: ${formatCurrency(prev30Revenue)}`,
        `  - Growth rate: ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%`
      )
    }

    changes.push(
      '',
      `**Forecast:**`,
      `  - Projected ${days}-day revenue: ${formatCurrency(projectedRevenue)}`,
      `  - Confidence: ${confidence.toUpperCase()}`,
      '',
      `💡 Note: Forecast assumes similar treatment patterns continue.`
    )

    return {
      success: true,
      action: 'forecast_revenue',
      params,
      result: {
        changes,
        forecast: {
          days,
          projected_revenue_cents: projectedRevenue,
          avg_daily_revenue_cents: Math.round(avgDailyRevenue),
          growth_rate_pct: growthRate,
          confidence,
          data_points: treatments.length,
        },
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'forecast_revenue',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Analyze patient retention
 */
export async function executeAnalyzePatientRetention(
  params: ActionParams['analyze_patient_retention'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const periodDays = params.period_days || 90

  try {
    const startDate = getDateDaysAgo(periodDays)

    // Get all patients with their treatments
    const { data: patients } = await supabase
      .from('patients')
      .select('id, created_at, first_name, last_name')
      .eq('clinic_id', clinicId)

    const { data: treatments } = await supabase
      .from('treatments')
      .select('patient_id, treatment_date')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', startDate.toISOString())

    if (!patients || patients.length === 0) {
      return {
        success: true,
        action: 'analyze_patient_retention',
        params,
        result: { changes: ['No patients found'], retention: {} },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Analyze retention
    const patientTreatments = new Map<string, number>()
    treatments?.forEach(t => {
      patientTreatments.set(t.patient_id, (patientTreatments.get(t.patient_id) || 0) + 1)
    })

    const totalPatients = patients.length
    const activePatients = patientTreatments.size
    const newPatients = patients.filter(p => new Date(p.created_at) >= startDate).length

    // Categorize by visit frequency
    let oneVisit = 0
    let twoToThree = 0
    let fourPlus = 0

    patientTreatments.forEach(count => {
      if (count === 1) oneVisit++
      else if (count <= 3) twoToThree++
      else fourPlus++
    })

    const retentionRate = totalPatients > 0 ? (activePatients / totalPatients) * 100 : 0
    const repeatRate = activePatients > 0 ? ((twoToThree + fourPlus) / activePatients) * 100 : 0

    const changes = [
      `👥 Patient Retention Analysis (${periodDays} days)`,
      '',
      `**Overview:**`,
      `  - Total patients: ${totalPatients}`,
      `  - Active patients (visited): ${activePatients}`,
      `  - New patients: ${newPatients}`,
      '',
      `**Retention Metrics:**`,
      `  - Retention rate: ${retentionRate.toFixed(1)}%`,
      `  - Repeat visit rate: ${repeatRate.toFixed(1)}%`,
      '',
      `**Visit Frequency:**`,
      `  - 1 visit: ${oneVisit} patients (${activePatients > 0 ? ((oneVisit / activePatients) * 100).toFixed(0) : 0}%)`,
      `  - 2-3 visits: ${twoToThree} patients (${activePatients > 0 ? ((twoToThree / activePatients) * 100).toFixed(0) : 0}%)`,
      `  - 4+ visits: ${fourPlus} patients (${activePatients > 0 ? ((fourPlus / activePatients) * 100).toFixed(0) : 0}%)`,
    ]

    // Add recommendations
    if (repeatRate < 30) {
      changes.push('', '💡 **Recommendation:** Consider implementing a follow-up program to improve repeat visits.')
    } else if (repeatRate > 60) {
      changes.push('', '✨ **Great job!** Your repeat visit rate is excellent.')
    }

    return {
      success: true,
      action: 'analyze_patient_retention',
      params,
      result: {
        changes,
        retention: {
          total_patients: totalPatients,
          active_patients: activePatients,
          new_patients: newPatients,
          retention_rate_pct: retentionRate,
          repeat_rate_pct: repeatRate,
          one_visit: oneVisit,
          two_to_three: twoToThree,
          four_plus: fourPlus,
        },
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'analyze_patient_retention',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

/**
 * Optimize inventory
 */
export async function executeOptimizeInventory(
  params: ActionParams['optimize_inventory'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const daysAhead = params.days_ahead || 30
  const reorderThreshold = params.reorder_threshold_pct || 25

  try {
    // Get supplies with their usage in service recipes
    const [suppliesResult, serviceSuppliesResult, treatmentsResult] = await Promise.all([
      supabase.from('supplies').select('id, name, stock_quantity, portions_per_presentation, price_cents').eq('clinic_id', clinicId),
      supabase.from('service_supplies').select('supply_id, qty, service_id'),
      supabase
        .from('treatments')
        .select('service_id')
        .eq('clinic_id', clinicId)
        .gte('treatment_date', getDateDaysAgo(30).toISOString()),
    ])

    const supplies = suppliesResult.data || []
    const serviceSupplies = serviceSuppliesResult.data || []
    const treatments = treatmentsResult.data || []

    if (supplies.length === 0) {
      return {
        success: true,
        action: 'optimize_inventory',
        params,
        result: { changes: ['No supplies found'], inventory: [] },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }

    // Calculate monthly usage for each supply
    const supplyUsage = new Map<string, number>()

    treatments.forEach(t => {
      const recipes = serviceSupplies.filter(ss => ss.service_id === t.service_id)
      recipes.forEach(r => {
        supplyUsage.set(r.supply_id, (supplyUsage.get(r.supply_id) || 0) + r.qty)
      })
    })

    // Analyze each supply
    const inventory = supplies.map(s => {
      const monthlyUsage = supplyUsage.get(s.id) || 0
      const dailyUsage = monthlyUsage / 30
      const daysOfStock = dailyUsage > 0 ? Math.floor(s.stock_quantity / dailyUsage) : 999
      const projectedUsage = Math.ceil(dailyUsage * daysAhead)
      const reorderPoint = Math.ceil((monthlyUsage * reorderThreshold) / 100)
      const needsReorder = s.stock_quantity <= reorderPoint

      return {
        id: s.id,
        name: s.name,
        stock_quantity: s.stock_quantity,
        monthly_usage: monthlyUsage,
        daily_usage: dailyUsage,
        days_of_stock: daysOfStock,
        projected_usage: projectedUsage,
        reorder_point: reorderPoint,
        needs_reorder: needsReorder,
        shortage_in_days: daysOfStock < daysAhead ? daysAhead - daysOfStock : null,
      }
    })

    // Sort by urgency
    const needsReorder = inventory.filter(i => i.needs_reorder).sort((a, b) => a.days_of_stock - b.days_of_stock)
    const willRunOut = inventory.filter(i => i.shortage_in_days !== null).sort((a, b) => (a.shortage_in_days || 999) - (b.shortage_in_days || 999))

    const changes = [`📦 Inventory Optimization (${daysAhead}-day forecast)`, '']

    if (needsReorder.length > 0) {
      changes.push(`⚠️ **Needs Reorder (${needsReorder.length} items):**`)
      needsReorder.forEach(i => {
        changes.push(`  - ${i.name}: ${i.stock_quantity} units (${i.days_of_stock} days of stock)`)
      })
      changes.push('')
    }

    if (willRunOut.length > 0) {
      changes.push(`🔴 **Will Run Out in ${daysAhead} Days:**`)
      willRunOut.forEach(i => {
        changes.push(`  - ${i.name}: runs out in ~${i.days_of_stock} days, need ${i.projected_usage - i.stock_quantity} more units`)
      })
      changes.push('')
    }

    if (needsReorder.length === 0 && willRunOut.length === 0) {
      changes.push(`✅ All supplies are well-stocked for the next ${daysAhead} days!`)
    }

    changes.push('', `**Summary:**`)
    changes.push(`  - Total supplies tracked: ${supplies.length}`)
    changes.push(`  - Need reorder: ${needsReorder.length}`)
    changes.push(`  - Will run out soon: ${willRunOut.length}`)

    return {
      success: true,
      action: 'optimize_inventory',
      params,
      result: {
        changes,
        inventory,
        needs_reorder: needsReorder,
        will_run_out: willRunOut,
      },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'optimize_inventory',
      params,
      error: { code: 'EXECUTION_ERROR', message: error.message },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}
