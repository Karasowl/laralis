import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Get low stock alerts
    const { data: lowStockAlerts, error: stockError } = await supabase
      .from('low_stock_alerts')
      .select('*')
      .eq('clinic_id', clinicId)

    if (stockError) {
      console.error('Error fetching low stock alerts:', stockError)
    }

    // Get recent price changes (supplies where last purchase price differs significantly from current price)
    const { data: priceChanges, error: priceError } = await supabase
      .from('supplies')
      .select(`
        id,
        name,
        category,
        price_per_portion_cents,
        last_purchase_price_cents,
        last_purchase_date
      `)
      .eq('clinic_id', clinicId)
      .not('last_purchase_price_cents', 'is', null)
      .not('last_purchase_date', 'is', null)

    if (priceError) {
      console.error('Error fetching price changes:', priceError)
    }

    // Filter significant price changes (>10% difference)
    const significantPriceChanges = priceChanges?.filter(supply => {
      const currentPrice = supply.price_per_portion_cents
      const lastPrice = supply.last_purchase_price_cents
      if (!currentPrice || !lastPrice) return false
      
      const difference = Math.abs(currentPrice - lastPrice)
      const percentChange = (difference / currentPrice) * 100
      return percentChange > 10
    }).map(supply => ({
      ...supply,
      price_change_percentage: Math.round(((supply.last_purchase_price_cents! - supply.price_per_portion_cents) / supply.price_per_portion_cents) * 100)
    })) || []

    // Get budget alerts (expenses exceeding fixed costs by >20%)
    const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
    
    const { data: monthlyExpenses, error: expenseError } = await supabase
      .from('expenses')
      .select('amount_cents')
      .eq('clinic_id', clinicId)
      .gte('expense_date', `${currentMonth}-01`)
      .lt('expense_date', `${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().substring(0, 10)}`)

    if (expenseError) {
      console.error('Error fetching monthly expenses:', expenseError)
    }

    const { data: fixedCosts, error: fixedError } = await supabase
      .from('fixed_costs')
      .select('monthly_amount_cents')
      .eq('clinic_id', clinicId)

    if (fixedError) {
      console.error('Error fetching fixed costs:', fixedError)
    }

    const totalMonthlyExpenses = monthlyExpenses?.reduce((sum, expense) => sum + expense.amount_cents, 0) || 0
    const totalFixedCosts = fixedCosts?.reduce((sum, cost) => sum + cost.monthly_amount_cents, 0) || 0
    
    const budgetAlerts = []
    if (totalFixedCosts > 0 && totalMonthlyExpenses > totalFixedCosts * 1.2) {
      const overBudgetPercentage = Math.round(((totalMonthlyExpenses - totalFixedCosts) / totalFixedCosts) * 100)
      budgetAlerts.push({
        type: 'budget_exceeded',
        message: `Gastos del mes exceden presupuesto en ${overBudgetPercentage}%`,
        severity: overBudgetPercentage > 50 ? 'high' : 'medium',
        details: {
          planned: totalFixedCosts,
          actual: totalMonthlyExpenses,
          variance: totalMonthlyExpenses - totalFixedCosts,
          percentage: overBudgetPercentage
        }
      })
    }

    const alerts = {
      low_stock: lowStockAlerts || [],
      price_changes: significantPriceChanges,
      budget_alerts: budgetAlerts,
      summary: {
        total_alerts: (lowStockAlerts?.length || 0) + significantPriceChanges.length + budgetAlerts.length,
        by_severity: {
          high: budgetAlerts.filter(alert => alert.severity === 'high').length + (lowStockAlerts?.filter(alert => alert.stock_quantity === 0).length || 0),
          medium: budgetAlerts.filter(alert => alert.severity === 'medium').length + (lowStockAlerts?.filter(alert => alert.stock_quantity > 0).length || 0),
          low: significantPriceChanges.length
        }
      }
    }

    return NextResponse.json({ data: alerts })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}