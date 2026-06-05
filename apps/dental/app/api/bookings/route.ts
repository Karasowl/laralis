import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

const statusSchema = z.enum(['pending', 'confirmed', 'rejected', 'cancelled']).optional()

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
      return ids.map((id) => [id, row] as const)
    })
  )
}

function pick<T extends Record<string, any>>(row: T | null | undefined, keys: string[]) {
  if (!row) return null
  const out: Record<string, any> = {}
  for (const key of keys) out[key] = row[key] ?? null
  return out
}

async function getBookingsFromConvex(clinicId: string, status?: 'pending' | 'confirmed' | 'rejected' | 'cancelled') {
  const [bookings, services, patients, treatments] = await Promise.all([
    listConvexDocumentsByClinic('public_bookings', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  const servicesById = byId(services)
  const patientsById = byId(patients)
  const treatmentsById = byId(treatments)

  return bookings
    .filter((row) => (status ? row.status === status : true))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 100)
    .map((row) => {
      const normalized = normalizeConvexRecord(row) as ImportedRecord
      return {
        ...normalized,
        service: row.service_id
          ? pick(servicesById.get(String(row.service_id)), ['id', 'name', 'est_minutes', 'price_cents', 'variable_cost_cents'])
          : null,
        patient: row.patient_id
          ? pick(patientsById.get(String(row.patient_id)), ['id', 'first_name', 'last_name', 'email', 'phone'])
          : null,
        treatment: row.treatment_id
          ? pick(treatmentsById.get(String(row.treatment_id)), ['id', 'status', 'treatment_date', 'treatment_time'])
          : null,
      }
    })
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }

    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.view')
    if (forbidden) return forbidden

    const parsedStatus = statusSchema.safeParse(searchParams.get('status') || undefined)
    if (!parsedStatus.success) {
      return NextResponse.json({ error: 'Invalid booking status filter' }, { status: 400 })
    }

    if (shouldReturnConvexData('public_bookings')) {
      const data = await getBookingsFromConvex(clinicId, parsedStatus.data)
      return NextResponse.json({ data })
    }

    let query = supabaseAdmin
      .from('public_bookings')
      .select(`
        *,
        service:services (id, name, est_minutes, price_cents, variable_cost_cents),
        patient:patients (id, first_name, last_name, email, phone),
        treatment:treatments (id, status, treatment_date, treatment_time)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (parsedStatus.data) {
      query = query.eq('status', parsedStatus.data)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('bookings.get error', error)
    return NextResponse.json({ error: 'Failed to fetch booking requests' }, { status: 500 })
  }
}
