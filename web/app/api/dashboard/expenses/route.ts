import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')
    const period = searchParams.get('period') || 'month'
    
    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })
    }

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }

    // Get expenses
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('amount_cents')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDate.toISOString().split('T')[0])
      .lte('expense_date', now.toISOString().split('T')[0])

    if (error) throw error

    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_cents || 0), 0) || 0
    
    // Calculate trend (mock data for now)
    const trend = Math.random() > 0.5 ? 'up' : 'down'
    const trendValue = Math.floor(Math.random() * 15) + 1

    return NextResponse.json({
      total: totalExpenses,
      trend,
      trendValue,
      period
    })
  } catch (error) {
    console.error('Dashboard expenses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses data' },
      { status: 500 }
    )
  }
}