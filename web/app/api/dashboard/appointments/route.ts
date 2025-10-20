import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const searchParams = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId } = ctx

    // For now, return mock data since appointments table might not exist yet
    // In production, this would query the appointments table
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Mock data for appointments
    const todayAppointments = Math.floor(Math.random() * 8) + 3
    const tomorrowAppointments = Math.floor(Math.random() * 8) + 2
    const weeklyAppointments = Math.floor(Math.random() * 30) + 15

    return NextResponse.json({
      today: todayAppointments,
      tomorrow: tomorrowAppointments,
      thisWeek: weeklyAppointments,
      trend: 'stable',
      trendValue: 0
    })
  } catch (error) {
    console.error('Dashboard appointments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments data' },
      { status: 500 }
    )
  }
}
