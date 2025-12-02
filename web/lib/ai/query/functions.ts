/**
 * Query Function Execution
 *
 * Executes database queries for the analytics/query mode.
 * These functions are called by the LLM via function calling.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueryContext } from '../types'

/**
 * Execute a function call safely
 * Routes to appropriate handler based on function name
 */
export async function executeFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  context: QueryContext
): Promise<Record<string, unknown>> {
  const { clinicId, supabase } = context

  if (!supabase) {
    throw new Error('Supabase client is required for function execution')
  }

  switch (functionName) {
    case 'query_revenue':
      return executeQueryRevenue(supabase, clinicId, args)

    case 'get_top_services':
      return executeGetTopServicesQuery(supabase, clinicId, args)

    case 'analyze_expenses':
      return executeAnalyzeExpenses(supabase, clinicId, args)

    case 'get_patient_stats':
      return executeGetPatientStats(supabase, clinicId, args)

    default:
      throw new Error(`Unknown function: ${functionName}`)
  }
}

/**
 * Query revenue data
 */
async function executeQueryRevenue(
  supabase: SupabaseClient,
  clinicId: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const start_date = args.start_date as string | undefined
  const end_date = args.end_date as string | undefined

  let query = supabase
    .from('treatments')
    .select('treatment_date, price_cents')
    .eq('clinic_id', clinicId)

  if (start_date) {
    query = query.gte('treatment_date', start_date)
  }
  if (end_date) {
    query = query.lte('treatment_date', end_date)
  }

  const { data: treatments, error } = await query

  if (error) {
    throw error
  }

  // Calculate total revenue
  const totalRevenueCents =
    treatments?.reduce(
      (sum: number, t: { price_cents?: number }) => sum + (t.price_cents || 0),
      0
    ) || 0

  // Group by date
  const revenueByDate = treatments?.reduce(
    (
      acc: Record<string, number>,
      treatment: { treatment_date: string; price_cents?: number }
    ) => {
      const date = treatment.treatment_date
      if (!acc[date]) {
        acc[date] = 0
      }
      acc[date] += treatment.price_cents || 0
      return acc
    },
    {} as Record<string, number>
  )

  return {
    total_revenue_cents: totalRevenueCents,
    revenue_by_date: revenueByDate,
    period: {
      start: start_date || null,
      end: end_date || null,
    },
    treatments_count: treatments?.length || 0,
  }
}

/**
 * Get top performing services
 */
async function executeGetTopServicesQuery(
  supabase: SupabaseClient,
  clinicId: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const metric = (args.metric as string) || 'revenue'
  const limit = (args.limit as number) || 10
  const start_date = args.start_date as string | undefined
  const end_date = args.end_date as string | undefined

  let query = supabase
    .from('treatments')
    .select(
      `
      service_id,
      price_cents,
      services(
        id,
        name
      )
    `
    )
    .eq('clinic_id', clinicId)

  if (start_date) {
    query = query.gte('treatment_date', start_date)
  }
  if (end_date) {
    query = query.lte('treatment_date', end_date)
  }

  const { data: treatments, error } = await query

  if (error) {
    throw error
  }

  // Aggregate by service
  const serviceMap: Record<
    string,
    { id: string; name: string; revenue: number; count: number }
  > = {}

  type TreatmentWithService = {
    service_id: string
    price_cents: number
    services: { name: string } | { name: string }[] | null
  }

  treatments?.forEach((t: any) => {
    const treatment = t as TreatmentWithService
    if (!treatment.service_id) return

    let serviceName = 'Unknown Service'
    if (treatment.services) {
      if (Array.isArray(treatment.services)) {
        serviceName = treatment.services[0]?.name || 'Unknown Service'
      } else {
        serviceName = treatment.services.name
      }
    }

    const serviceId = treatment.service_id
    if (!serviceMap[serviceId]) {
      serviceMap[serviceId] = {
        id: serviceId,
        name: serviceName,
        revenue: 0,
        count: 0,
      }
    }
    serviceMap[serviceId].revenue += treatment.price_cents || 0
    serviceMap[serviceId].count += 1
  })

  // Convert to array and sort
  let services = Object.values(serviceMap)

  if (metric === 'revenue') {
    services.sort((a, b) => b.revenue - a.revenue)
  } else if (metric === 'frequency') {
    services.sort((a, b) => b.count - a.count)
  }

  // Apply limit
  services = services.slice(0, limit)

  return {
    services,
    total_services: services.length,
    metric,
  }
}

/**
 * Analyze expenses
 */
async function executeAnalyzeExpenses(
  supabase: SupabaseClient,
  clinicId: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const category_id = args.category_id as string | undefined
  const start_date = args.start_date as string | undefined
  const end_date = args.end_date as string | undefined

  let query = supabase
    .from('expenses')
    .select(
      `
      id,
      amount_cents,
      category_id,
      expense_date,
      description,
      custom_categories(
        id,
        name
      )
    `
    )
    .eq('clinic_id', clinicId)

  if (category_id) {
    query = query.eq('category_id', category_id)
  }
  if (start_date) {
    query = query.gte('expense_date', start_date)
  }
  if (end_date) {
    query = query.lte('expense_date', end_date)
  }

  const { data: expenses, error } = await query

  if (error) {
    throw error
  }

  // Calculate total
  const totalExpensesCents =
    expenses?.reduce(
      (sum: number, e: { amount_cents?: number }) => sum + (e.amount_cents || 0),
      0
    ) || 0

  // Group by category
  const expensesByCategory: Record<
    string,
    { name: string; amount: number; count: number }
  > = {}

  type ExpenseWithCategory = {
    amount_cents: number
    custom_categories: { name: string } | { name: string }[] | null
  }

  expenses?.forEach((e: any) => {
    const expense = e as ExpenseWithCategory

    let categoryName = 'Sin categoría'
    if (expense.custom_categories) {
      if (Array.isArray(expense.custom_categories)) {
        categoryName = expense.custom_categories[0]?.name || 'Sin categoría'
      } else {
        categoryName = expense.custom_categories.name
      }
    }

    if (!expensesByCategory[categoryName]) {
      expensesByCategory[categoryName] = { name: categoryName, amount: 0, count: 0 }
    }
    expensesByCategory[categoryName].amount += expense.amount_cents || 0
    expensesByCategory[categoryName].count += 1
  })

  return {
    total_expenses_cents: totalExpensesCents,
    expenses_by_category: Object.values(expensesByCategory),
    expenses_count: expenses?.length || 0,
    period: {
      start: start_date || null,
      end: end_date || null,
    },
  }
}

/**
 * Get patient statistics
 */
async function executeGetPatientStats(
  supabase: SupabaseClient,
  clinicId: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const start_date = args.start_date as string | undefined
  const end_date = args.end_date as string | undefined

  // Get all patients for the clinic
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, created_at')
    .eq('clinic_id', clinicId)

  if (patientsError) {
    throw patientsError
  }

  // Get treatments for date range to calculate active patients
  let treatmentsQuery = supabase
    .from('treatments')
    .select('patient_id')
    .eq('clinic_id', clinicId)

  if (start_date) {
    treatmentsQuery = treatmentsQuery.gte('treatment_date', start_date)
  }
  if (end_date) {
    treatmentsQuery = treatmentsQuery.lte('treatment_date', end_date)
  }

  const { data: treatments, error: treatmentsError } = await treatmentsQuery

  if (treatmentsError) {
    throw treatmentsError
  }

  // Calculate unique active patients in period
  const activePatientIds = new Set(
    treatments?.map((t: { patient_id: string }) => t.patient_id) || []
  )

  return {
    total_patients: patients?.length || 0,
    active_patients_in_period: activePatientIds.size,
    period: {
      start: start_date || null,
      end: end_date || null,
    },
  }
}
