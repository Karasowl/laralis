import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')
    
    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })
    }

    // Get total treatments count
    const { count, error } = await supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    if (error) throw error

    // Get treatments this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: monthlyTreatments, error: monthError } = await supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfMonth.toISOString())

    if (monthError) throw monthError

    // Get pending treatments
    const { count: pendingCount, error: pendingError } = await supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'pending')

    if (pendingError) throw pendingError

    return NextResponse.json({
      total: count || 0,
      thisMonth: monthlyTreatments || 0,
      pending: pendingCount || 0,
      trend: monthlyTreatments && monthlyTreatments > 5 ? 'up' : 'stable',
      trendValue: monthlyTreatments || 0
    })
  } catch (error) {
    console.error('Dashboard treatments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch treatments data' },
      { status: 500 }
    )
  }
}