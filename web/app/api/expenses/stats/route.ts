import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type ExpenseStats } from '@/lib/types/expenses'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get clinic_id from query params
    const clinicId = searchParams.get('clinic_id')
    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    // Get date range for analysis
    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]

    // Get total expenses for the period
    const { data: totalExpenses, error: totalError } = await supabase
      .from('expenses')
      .select('amount_cents')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)

    if (totalError) {
      console.error('Error fetching total expenses:', totalError)
      return NextResponse.json({ error: 'Failed to fetch expense stats' }, { status: 500 })
    }

    const totalAmount = totalExpenses.reduce((sum, expense) => sum + expense.amount_cents, 0)
    const totalCount = totalExpenses.length

    // Get expenses by category
    const { data: categoryExpenses, error: categoryError } = await supabase
      .from('expenses')
      .select('category, amount_cents')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)

    if (categoryError) {
      console.error('Error fetching category expenses:', categoryError)
      return NextResponse.json({ error: 'Failed to fetch category stats' }, { status: 500 })
    }

    // Group by category
    const categoryStats = categoryExpenses.reduce((acc, expense) => {
      const category = expense.category
      if (!acc[category]) {
        acc[category] = { amount: 0, count: 0 }
      }
      acc[category].amount += expense.amount_cents
      acc[category].count += 1
      return acc
    }, {} as Record<string, { amount: number; count: number }>)

    const byCategory = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      amount: stats.amount,
      count: stats.count,
      percentage: totalAmount > 0 ? Math.round((stats.amount / totalAmount) * 100) : 0
    }))

    // Get expenses by month (for trends)
    const { data: monthlyExpenses, error: monthlyError } = await supabase
      .from('expenses')
      .select('expense_date, amount_cents')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date')

    if (monthlyError) {
      console.error('Error fetching monthly expenses:', monthlyError)
      return NextResponse.json({ error: 'Failed to fetch monthly stats' }, { status: 500 })
    }

    // Group by month
    const monthlyStats = monthlyExpenses.reduce((acc, expense) => {
      const month = expense.expense_date.substring(0, 7) // YYYY-MM format
      if (!acc[month]) {
        acc[month] = { amount: 0, count: 0 }
      }
      acc[month].amount += expense.amount_cents
      acc[month].count += 1
      return acc
    }, {} as Record<string, { amount: number; count: number }>)

    const byMonth = Object.entries(monthlyStats).map(([month, stats]) => ({
      month,
      amount: stats.amount,
      count: stats.count
    }))

    // Get fixed costs for comparison
    const { data: fixedCosts, error: fixedCostsError } = await supabase
      .from('fixed_costs')
      .select('monthly_amount_cents')
      .eq('clinic_id', clinicId)

    if (fixedCostsError) {
      console.error('Error fetching fixed costs:', fixedCostsError)
    }

    const plannedFixedCosts = fixedCosts?.reduce((sum, cost) => sum + cost.monthly_amount_cents, 0) || 0
    
    // Calculate variance vs fixed costs
    const monthsInPeriod = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    const expectedFixedCosts = plannedFixedCosts * monthsInPeriod
    const variance = totalAmount - expectedFixedCosts
    const variancePercentage = expectedFixedCosts > 0 ? Math.round((variance / expectedFixedCosts) * 100) : 0

    const stats: ExpenseStats = {
      total_amount: totalAmount,
      total_count: totalCount,
      by_category: byCategory.sort((a, b) => b.amount - a.amount),
      by_month: byMonth.sort((a, b) => a.month.localeCompare(b.month)),
      vs_fixed_costs: {
        planned: expectedFixedCosts,
        actual: totalAmount,
        variance,
        variance_percentage: variancePercentage
      }
    }

    return NextResponse.json({ data: stats })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}