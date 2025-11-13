/**
 * Analytics: Treatment Frequency
 *
 * GET /api/analytics/treatments/frequency
 * Returns treatment patterns and frequency analysis
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

    // Get treatments with service info
    let query = supabase
      .from('treatments')
      .select(
        `
        treatment_date,
        service_id,
        services (
          name,
          category
        )
      `
      )
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

    // Group by day of week
    const treatmentsByDay = treatments?.reduce(
      (acc, treatment) => {
        const date = new Date(treatment.treatment_date)
        const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' })
        acc[dayOfWeek] = (acc[dayOfWeek] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Group by month
    const treatmentsByMonth = treatments?.reduce(
      (acc, treatment) => {
        const date = new Date(treatment.treatment_date)
        const month = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
        acc[month] = (acc[month] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Most common services
    const serviceFrequency = treatments?.reduce(
      (acc, treatment) => {
        const serviceId = treatment.service_id
        const serviceName = (treatment.services as any)?.name || 'Unknown'
        if (!acc[serviceId]) {
          acc[serviceId] = {
            service_id: serviceId,
            name: serviceName,
            count: 0,
          }
        }
        acc[serviceId].count += 1
        return acc
      },
      {} as Record<string, { service_id: string; name: string; count: number }>
    )

    const topServices = Object.values(serviceFrequency || {})
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({
      total_treatments: treatments?.length || 0,
      treatments_by_day: treatmentsByDay,
      treatments_by_month: treatmentsByMonth,
      top_services: topServices,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
    })
  } catch (error) {
    console.error('[API /analytics/treatments/frequency] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch treatment frequency',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
