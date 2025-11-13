/**
 * Analytics: Inventory Alerts
 *
 * GET /api/analytics/inventory/alerts
 * Returns supplies that may need restocking based on usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all supplies
    const { data: supplies, error: suppliesError } = await supabase
      .from('supplies')
      .select('id, name, category, cost_per_portion_cents, portions')
      .eq('clinic_id', clinicId)

    if (suppliesError) {
      throw suppliesError
    }

    // Get service_supplies to see usage
    const { data: serviceSupplies, error: serviceSuppliesError } = await supabase
      .from('service_supplies')
      .select('supply_id, qty')
      .eq('clinic_id', clinicId)

    if (serviceSuppliesError) {
      throw serviceSuppliesError
    }

    // Calculate usage frequency
    const supplyUsage = serviceSupplies?.reduce(
      (acc, ss) => {
        const supplyId = ss.supply_id
        if (!acc[supplyId]) {
          acc[supplyId] = {
            services_count: 0,
            total_qty: 0,
          }
        }
        acc[supplyId].services_count += 1
        acc[supplyId].total_qty += ss.qty || 0
        return acc
      },
      {} as Record<string, { services_count: number; total_qty: number }>
    )

    // Build alerts
    const alerts = supplies?.map((supply) => {
      const usage = supplyUsage?.[supply.id]
      const isHighUsage = usage && usage.services_count >= 3 // Used in 3+ services
      const isLowStock = supply.portions && supply.portions < 10 // Less than 10 portions

      return {
        supply_id: supply.id,
        name: supply.name,
        category: supply.category,
        portions: supply.portions,
        services_using: usage?.services_count || 0,
        alert_level: isHighUsage && isLowStock ? 'high' : isLowStock ? 'medium' : 'low',
        message:
          isHighUsage && isLowStock
            ? 'Alto uso y bajo stock - reabastecer pronto'
            : isLowStock
              ? 'Bajo stock'
              : isHighUsage
                ? 'Alto uso - monitorear'
                : 'Stock normal',
      }
    })

    // Filter to only show alerts (medium and high)
    const criticalAlerts = alerts?.filter((a) => a.alert_level !== 'low') || []

    return NextResponse.json({
      total_supplies: supplies?.length || 0,
      alerts: criticalAlerts,
      alert_count: criticalAlerts.length,
    })
  } catch (error) {
    console.error('[API /analytics/inventory/alerts] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
