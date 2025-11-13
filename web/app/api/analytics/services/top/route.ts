/**
 * Analytics: Top Services
 *
 * GET /api/analytics/services/top
 * Returns services sorted by revenue, frequency, or margin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const metric = searchParams.get('metric') || 'revenue'
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

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

    // Build query based on metric
    let query = supabase
      .from('treatments')
      .select(
        `
        service_id,
        price_cents,
        services (
          name,
          category
        )
      `
      )
      .eq('clinic_id', clinicId)

    // Apply date filters
    if (startDate) {
      query = query.gte('treatment_date', startDate)
    }
    if (endDate) {
      query = query.lte('treatment_date', endDate)
    }

    const { data: treatments, error } = await query

    if (error) {
      throw error
    }

    // Aggregate by service
    const serviceStats = treatments?.reduce(
      (acc, treatment) => {
        const serviceId = treatment.service_id
        if (!acc[serviceId]) {
          acc[serviceId] = {
            service_id: serviceId,
            name: (treatment.services as any)?.name || 'Unknown',
            category: (treatment.services as any)?.category || null,
            count: 0,
            total_revenue_cents: 0,
          }
        }
        acc[serviceId].count += 1
        acc[serviceId].total_revenue_cents += treatment.price_cents || 0
        return acc
      },
      {} as Record<
        string,
        {
          service_id: string
          name: string
          category: string | null
          count: number
          total_revenue_cents: number
        }
      >
    )

    // Convert to array and sort
    const servicesArray = Object.values(serviceStats || {})

    let sortedServices = servicesArray
    if (metric === 'revenue') {
      sortedServices.sort((a, b) => b.total_revenue_cents - a.total_revenue_cents)
    } else if (metric === 'frequency') {
      sortedServices.sort((a, b) => b.count - a.count)
    }

    // Limit results
    const topServices = sortedServices.slice(0, limit)

    return NextResponse.json({
      services: topServices,
      metric,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
      total_services: servicesArray.length,
    })
  } catch (error) {
    console.error('[API /analytics/services/top] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch top services',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
