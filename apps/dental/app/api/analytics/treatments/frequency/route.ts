/**
 * Analytics: Treatment Frequency
 *
 * GET /api/analytics/treatments/frequency
 * Returns treatment patterns and frequency analysis
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

/**
 * Convex equivalent of the Supabase aggregation path.
 *
 * Supabase reads `treatments` with a nested join `services (name, category)`
 * filtered by clinic + optional treatment_date range, then aggregates:
 *   - treatments_by_day:   count grouped by es-ES weekday name
 *   - treatments_by_month: count grouped by es-ES "year + long month"
 *   - top_services:        count grouped by service_id (name from join), top 10
 *
 * Convex has no relational joins, so we fetch `treatments` and `services`
 * separately and reassemble in JS by matching `service_id` to a
 * Map<serviceId, service>, preserving the exact join shape used by the
 * Supabase branch (services?.name || 'Unknown').
 *
 * NUMERIC / BUCKET FIDELITY: the date bucket keys are produced by the IDENTICAL
 * code — `new Date(treatment.treatment_date)` + `toLocaleDateString('es-ES', ...)`
 * with the same options — so weekday/month bucket labels match byte-for-byte.
 * Date range filtering uses lexicographic YYYY-MM-DD comparison, matching the
 * Postgres gte/lte ordering. Counts are plain integer increments (no floats).
 */
async function getTreatmentFrequencyFromConvex(params: {
  clinicId: string
  startDate: string | null
  endDate: string | null
}) {
  const { clinicId, startDate, endDate } = params

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
  // Reassemble the nested `services` join so the aggregation below is identical
  // to the Supabase branch (which reads treatment.services?.name).
  const treatments = treatmentsRaw
    .map(normalizeConvexRecord)
    .filter((treatment) => {
      if (startDate && String(treatment.treatment_date || '') < startDate) return false
      if (endDate && String(treatment.treatment_date || '') > endDate) return false
      return true
    })
    .map((treatment) => {
      const serviceId = treatment.service_id
      const service = serviceId != null ? servicesById.get(String(serviceId)) : undefined
      return {
        treatment_date: treatment.treatment_date,
        service_id: serviceId,
        services: service ? { name: service.name, category: service.category } : null,
      }
    })

  return treatments
}

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

    if (!(await verifyClinicAccess(user.id, clinicId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (shouldReturnConvexData('treatments')) {
      const treatments = await getTreatmentFrequencyFromConvex({ clinicId, startDate, endDate })

      // Group by day of week (identical to Supabase branch below)
      const treatmentsByDay = treatments.reduce(
        (acc, treatment) => {
          const date = new Date(treatment.treatment_date)
          const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' })
          acc[dayOfWeek] = (acc[dayOfWeek] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      // Group by month (identical to Supabase branch below)
      const treatmentsByMonth = treatments.reduce(
        (acc, treatment) => {
          const date = new Date(treatment.treatment_date)
          const month = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
          acc[month] = (acc[month] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      // Most common services (identical to Supabase branch below)
      const serviceFrequency = treatments.reduce(
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

      const topServices = Object.values(serviceFrequency)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return NextResponse.json({
        total_treatments: treatments.length,
        treatments_by_day: treatmentsByDay,
        treatments_by_month: treatmentsByMonth,
        top_services: topServices,
        period: {
          start: startDate || null,
          end: endDate || null,
        },
      })
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
