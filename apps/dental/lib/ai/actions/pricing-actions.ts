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

/**
 * Execute: Update service price
 */
export async function executeUpdateServicePrice(
  params: ActionParams['update_service_price'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId, dryRun } = context
  const { service_id, new_price_cents, reason } = params

  try {
    // Get current service data
    const { data: serviceBefore, error: fetchError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .eq('clinic_id', clinicId)
      .single()

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
    const { data: serviceAfter, error: updateError } = await supabase
      .from('services')
      .update({
        price_cents: new_price_cents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', service_id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (updateError) {
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
  const { supabase, clinicId, userId, dryRun } = context
  const { service_id, target_margin_pct, adjust_price = false } = params

  try {
    // Get current service with cost data
    const { data: service, error: fetchError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .eq('clinic_id', clinicId)
      .single()

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
    const { data: updatedService, error: updateError } = await supabase
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

    if (updateError) {
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
export async function executeSimulatePriceChange(
  params: ActionParams['simulate_price_change'],
  context: ActionContext
): Promise<ActionResult> {
  const { supabase, clinicId, userId } = context
  const { service_id, change_type, change_value } = params

  try {
    // Build services query
    let servicesQuery = supabase
      .from('services')
      .select('id, name, price_cents, fixed_cost_cents, variable_cost_cents, margin_pct')
      .eq('clinic_id', clinicId)

    if (service_id) {
      servicesQuery = servicesQuery.eq('id', service_id)
    }

    const { data: services, error: servicesError } = await servicesQuery

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

    // Get historical treatment data for volume estimation (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: treatments } = await supabase
      .from('treatments')
      .select('service_id, price_cents')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', thirtyDaysAgo.toISOString().split('T')[0])

    // Count treatments by service
    const treatmentCounts: Record<string, number> = {}
    const treatmentRevenue: Record<string, number> = {}

    treatments?.forEach((t) => {
      treatmentCounts[t.service_id] = (treatmentCounts[t.service_id] || 0) + 1
      treatmentRevenue[t.service_id] =
        (treatmentRevenue[t.service_id] || 0) + (t.price_cents || 0)
    })

    // Calculate simulation results
    const simulationResults = services.map((service) => {
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
        treatmentCount > 0
          ? Math.round((newPrice / currentPrice) * currentMonthlyRevenue)
          : 0

      // Calculate profit changes
      const totalCost =
        (service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0)
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
  const { supabase, clinicId, userId, dryRun } = context
  const { amount_cents, category_id, description, expense_date } = params

  try {
    // Verify category exists
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, display_name')
      .eq('id', category_id)
      .single()

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
    const { data: expense, error: insertError } = await supabase
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

    if (insertError) {
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
  const { supabase, clinicId, userId, dryRun } = context
  const { work_days, hours_per_day, real_productivity_pct } = params

  try {
    // Get current settings
    const { data: currentSettings } = await supabase
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

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

    let result
    if (currentSettings) {
      // Update existing settings
      result = await supabase
        .from('settings_time')
        .update(updates)
        .eq('id', currentSettings.id)
        .select()
        .single()
    } else {
      // Create new settings
      result = await supabase
        .from('settings_time')
        .insert({
          clinic_id: clinicId,
          work_days: work_days ?? 22,
          working_days_per_month: work_days ?? 22,
          hours_per_day: hours_per_day ?? 8,
          real_pct: (real_productivity_pct ?? 80) / 100,
          real_hours_percentage: (real_productivity_pct ?? 80) / 100,
        })
        .select()
        .single()
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
