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

    // Generate last 6 months of revenue data
    const months = []
    const data = []
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      months.push(monthNames[date.getMonth()])
      
      // Generate mock revenue data with some variation
      const baseRevenue = 50000 + (Math.random() * 30000)
      data.push(Math.floor(baseRevenue))
    }

    return NextResponse.json({
      labels: months,
      datasets: [{
        label: 'Ingresos',
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      }]
    })
  } catch (error) {
    console.error('Dashboard revenue chart error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue chart data' },
      { status: 500 }
    )
  }
}