import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
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

    // Get revenue from treatments
    const { data: treatments, error } = await supabase
      .from('treatments')
      .select('price_cents')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())

    if (error) throw error

    const totalRevenue = treatments?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0
    
    // Calculate trend (mock data for now)
    const trend = Math.random() > 0.5 ? 'up' : 'down'
    const trendValue = Math.floor(Math.random() * 20) + 1

    return NextResponse.json({
      total: totalRevenue,
      trend,
      trendValue,
      period
    })
  } catch (error) {
    console.error('Dashboard revenue error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    )
  }
}