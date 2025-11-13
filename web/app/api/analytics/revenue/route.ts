/**
 * Analytics: Revenue
 *
 * GET /api/analytics/revenue
 * Returns revenue data filtered by date range
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const groupBy = searchParams.get('group_by') || 'day'

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

    // Build query
    let query = supabase
      .from('treatments')
      .select('treatment_date, price_cents')
      .eq('clinic_id', clinicId)

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

    // Calculate total revenue
    const totalRevenueCents = treatments?.reduce(
      (sum, t) => sum + (t.price_cents || 0),
      0
    ) || 0

    // Group by date
    const revenueByDate = treatments?.reduce(
      (acc, treatment) => {
        const date = treatment.treatment_date
        if (!acc[date]) {
          acc[date] = 0
        }
        acc[date] += treatment.price_cents || 0
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      total_revenue_cents: totalRevenueCents,
      revenue_by_date: revenueByDate,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
      treatments_count: treatments?.length || 0,
    })
  } catch (error) {
    console.error('[API /analytics/revenue] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch revenue data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
