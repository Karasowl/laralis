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

    // Get total patients count
    const { count, error } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    if (error) throw error

    // Get new patients this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: newPatients, error: newError } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfMonth.toISOString())

    if (newError) throw newError

    // Calculate trend
    const trend = newPatients && newPatients > 0 ? 'up' : 'stable'
    const trendValue = newPatients || 0

    return NextResponse.json({
      total: count || 0,
      newThisMonth: newPatients || 0,
      trend,
      trendValue
    })
  } catch (error) {
    console.error('Dashboard patients error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patients data' },
      { status: 500 }
    )
  }
}