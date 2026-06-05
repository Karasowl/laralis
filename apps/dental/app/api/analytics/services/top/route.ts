/**
 * Analytics: Top Services
 *
 * GET /api/analytics/services/top
 * Returns services sorted by revenue, frequency, or margin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { verifyClinicAccess } from '@/lib/auth/verify-clinic-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

type TopServiceStat = {
  service_id: string
  name: string
  category: string | null
  count: number
  total_revenue_cents: number
}

/**
 * Convex equivalent of the Supabase aggregation path.
 *
 * Supabase reads `treatments` with a nested join `services (name, category)`
 * filtered by clinic + optional treatment_date range, then aggregates by
 * service_id (count + total_revenue_cents). Convex has no relational joins, so
 * we fetch `treatments` and `services` separately and reassemble in JS by
 * matching `service_id` to a Map<serviceId, service>, preserving the exact
 * nested shape (services?.name || 'Unknown', services?.category || null).
 *
 * NUMERIC FIDELITY: same lexicographic YYYY-MM-DD date boundaries (gte/lte),
 * same `count += 1`, same `total_revenue_cents += price_cents || 0` (integer
 * cents, no float math), same sort + slice as the Supabase branch.
 */
async function getTopServicesFromConvex(params: {
  clinicId: string
  metric: string
  limit: number
  startDate: string | null
  endDate: string | null
}) {
  const { clinicId, metric, limit, startDate, endDate } = params

  const [treatmentsRaw, servicesRaw] = await Promise.all([
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  // Build Map<serviceId, service> to replace the Supabase nested select.
  const servicesById = new Map<string, ImportedRecord>()
  for (const raw of servicesRaw) {
    const service = normalizeConvexRecord(raw)
    const ids = [service.id, raw.legacyId].filter(Boolean).map((id) => String(id))
    for (const id of ids) {
      if (!servicesById.has(id)) servicesById.set(id, service)
    }
  }

  // Apply the SAME filters the Supabase query applies:
  //   .eq('clinic_id', clinicId)  -> already enforced by listByClinic
  //   .gte('treatment_date', startDate) / .lte('treatment_date', endDate)
  // Date comparison is lexicographic on YYYY-MM-DD, matching Supabase.
  const treatments = treatmentsRaw
    .map(normalizeConvexRecord)
    .filter((treatment) => {
      if (startDate && String(treatment.treatment_date || '') < startDate) return false
      if (endDate && String(treatment.treatment_date || '') > endDate) return false
      return true
    })

  // Aggregate by service, reassembling the nested service join in JS.
  const serviceStats = treatments.reduce(
    (acc, treatment) => {
      const serviceId = treatment.service_id
      const service = serviceId != null ? servicesById.get(String(serviceId)) : undefined
      if (!acc[serviceId]) {
        acc[serviceId] = {
          service_id: serviceId,
          name: service?.name || 'Unknown',
          category: service?.category || null,
          count: 0,
          total_revenue_cents: 0,
        }
      }
      acc[serviceId].count += 1
      acc[serviceId].total_revenue_cents += treatment.price_cents || 0
      return acc
    },
    {} as Record<string, TopServiceStat>
  )

  const servicesArray = Object.values(serviceStats)

  const sortedServices = servicesArray
  if (metric === 'revenue') {
    sortedServices.sort((a, b) => b.total_revenue_cents - a.total_revenue_cents)
  } else if (metric === 'frequency') {
    sortedServices.sort((a, b) => b.count - a.count)
  }

  const topServices = sortedServices.slice(0, limit)

  return {
    services: topServices,
    metric,
    period: {
      start: startDate || null,
      end: endDate || null,
    },
    total_services: servicesArray.length,
  }
}

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

    if (!(await verifyClinicAccess(user.id, clinicId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (shouldReturnConvexData('treatments')) {
      const result = await getTopServicesFromConvex({ clinicId, metric, limit, startDate, endDate })
      return NextResponse.json(result)
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
