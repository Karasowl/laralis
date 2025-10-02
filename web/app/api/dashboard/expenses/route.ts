import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const cookieStore = cookies()
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId } = ctx
    const period = searchParams.get('period') || 'month'
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    
    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })
    }

    // Calculate date range based on period or custom
    let now = new Date()
    let startDate = new Date(now)
    let endDate = new Date(now)

    if (period === 'custom' && dateFrom && dateTo) {
      startDate = new Date(dateFrom)
      endDate = new Date(dateTo)
      endDate.setHours(23,59,59,999)
    } else {
      switch (period) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          // Current month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }
    }

    // Get expenses
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('amount_cents')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDate.toISOString().split('T')[0])
      .lte('expense_date', endDate.toISOString().split('T')[0])

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
