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

    // Get supplies count and low stock items
    const { data: supplies, error } = await supabase
      .from('supplies')
      .select('*')
      .eq('clinic_id', clinicId)

    if (error) throw error

    const totalSupplies = supplies?.length || 0
    const lowStock = supplies?.filter(s => {
      const stock = s.current_stock || 0
      const min = s.min_stock || 0
      return stock <= min
    }).length || 0

    // Calculate total inventory value
    const inventoryValue = supplies?.reduce((sum, s) => {
      return sum + ((s.current_stock || 0) * (s.unit_cost_cents || 0))
    }, 0) || 0

    return NextResponse.json({
      total: totalSupplies,
      lowStock,
      inventoryValue,
      trend: lowStock > 0 ? 'warning' : 'good',
      trendValue: lowStock
    })
  } catch (error) {
    console.error('Dashboard supplies error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplies data' },
      { status: 500 }
    )
  }
}