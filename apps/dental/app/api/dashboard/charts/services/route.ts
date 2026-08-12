import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConvexDocumentsByClinic } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { formatDateToISO, parseLocalDate } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    const searchParams = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'financial_reports.view')
    if (forbidden) return forbidden

    const period = searchParams.get('period') || 'month'
    const dateFrom = searchParams.get('date_from') || searchParams.get('startDate')
    const dateTo = searchParams.get('date_to') || searchParams.get('endDate')

    const now = new Date()
    let start: Date | null = null
    let end: Date | null = null
    if (dateFrom && dateTo) {
      start = parseLocalDate(dateFrom)
      end = parseLocalDate(dateTo)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now)
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1)
      end = new Date(now)
    }

    const startISO = start && !Number.isNaN(start.getTime()) ? formatDateToISO(start) : null
    const endISO = end && !Number.isNaN(end.getTime()) ? formatDateToISO(end) : null

    let treatments: any[] = []
    const serviceNames = new Map<string, string>()

    if (shouldReturnConvexData('dashboard')) {
      const [convexTreatments, convexServices] = await Promise.all([
        listConvexDocumentsByClinic('treatments', clinicId),
        listConvexDocumentsByClinic('services', clinicId),
      ])
      treatments = convexTreatments.filter((treatment: any) => {
        const treatmentDate = String(treatment.treatment_date || '')
        return treatment.status !== 'cancelled'
          && (!startISO || treatmentDate >= startISO)
          && (!endISO || treatmentDate <= endISO)
      })
      for (const service of convexServices as any[]) {
        serviceNames.set(service.id, service.name || 'Servicio sin nombre')
      }
    } else {
      // Get treatments first, then resolve service names explicitly. This avoids
      // silently empty embedded relation results in chart/report contexts.
      let query = supabaseAdmin
        .from('treatments')
        .select('service_id, treatment_date, status')
        .eq('clinic_id', clinicId)
        .neq('status', 'cancelled')

      if (startISO) query = query.gte('treatment_date', startISO)
      if (endISO) query = query.lte('treatment_date', endISO)

      const { data, error } = await query

      if (error) throw error
      treatments = data || []

      const serviceIds = Array.from(new Set(treatments.map((treatment) => treatment.service_id).filter(Boolean)))
      if (serviceIds.length > 0) {
        const { data: services, error: serviceError } = await supabaseAdmin
          .from('services')
          .select('id, name')
          .in('id', serviceIds)
        if (serviceError) throw serviceError

        for (const service of services || []) {
          serviceNames.set(service.id, service.name || 'Servicio sin nombre')
        }
      }
    }

    const serviceCounts: Record<string, number> = {}
    treatments.forEach(treatment => {
      const serviceName = treatment.service_id ? serviceNames.get(treatment.service_id) || 'Servicio sin nombre' : 'Sin servicio'
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1
    })

    // Sort by count and take top 5
    const sorted = Object.entries(serviceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const labels = sorted.map(([name]) => name)
    const data = sorted.map(([, count]) => count)

    return NextResponse.json({
      services: sorted.map(([name, count]) => ({ name, count })),
      labels,
      datasets: [{
        label: 'Servicios Más Solicitados',
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    })
  } catch (error) {
    console.error('Dashboard services chart error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services chart data' },
      { status: 500 }
    )
  }
}
