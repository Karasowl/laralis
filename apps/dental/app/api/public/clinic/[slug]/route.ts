import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

// QA route contract: @qa-public-route public booking clinic profile by slug.
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

function byFk(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
      return ids.map((id) => [id, row] as const)
    })
  )
}

/**
 * Convex read branch.
 *
 * SECURITY: the Convex bridge has NO RLS. This is a PUBLIC route (no getUser),
 * so we intentionally add NO auth guard, but we MUST preserve the EXACT same
 * exposure as the Supabase path: clinic profile + ONLY whitelisted services
 * from `public_booking_services` (empty when none) — never the full catalog.
 *
 * Tables involved (all clinic-scoped EXCEPT the clinics lookup which is by slug):
 * - clinics: looked up by slug, so listByClinic is useless here. Use
 *   listConvexTable + JS filter on slug (same as /api/clinics Convex branch).
 * - public_booking_services: HAS clinic_id (migration 62) -> listByClinic.
 * - services: HAS clinic_id -> listByClinic, reassembled by FK on service_id.
 */
async function getPublicClinicFromConvex(
  slug: string
): Promise<PublicClinicResponse | { error: string; status: number }> {
  const clinics = await listConvexTable('clinics', 10000) as ImportedRecord[]
  const clinicRaw = clinics.find((row) => String(row.slug ?? '') === slug)

  if (!clinicRaw) {
    return { error: 'Clinic not found', status: 404 }
  }

  const clinic = normalizeConvexRecord(clinicRaw) as ImportedRecord

  const bookingConfig = clinic.booking_config as BookingConfig
  if (!bookingConfig?.enabled) {
    return { error: 'Online booking is not enabled for this clinic', status: 403 }
  }

  const clinicId = String(clinicRaw.id ?? clinicRaw.legacyId)

  const [whitelistRaw, servicesRaw] = await Promise.all([
    listConvexDocumentsByClinic('public_booking_services', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  const servicesByFk = byFk(servicesRaw)

  const whitelistedServices = whitelistRaw
    // Mirror Supabase `.eq('is_active', true)` (NULL excluded -> strict true)
    .filter((ws) => ws.is_active === true)
    // Mirror `.order('display_order', { ascending: true })`
    .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))

  let services: PublicClinicResponse['services'] = []

  if (whitelistedServices.length > 0) {
    services = whitelistedServices
      // Inner join semantics: Supabase join drops rows whose service is missing.
      .map((ws) => {
        const service = servicesByFk.get(String(ws.service_id))
        if (!service) return null
        return {
          id: service.id,
          name: service.name,
          description: service.description,
          price_cents: service.price_cents,
          duration_minutes: ws.custom_duration_minutes || service.est_minutes || bookingConfig.slot_duration_minutes,
          category: service.category,
        }
      })
      .filter((s): s is PublicClinicResponse['services'][number] => s !== null)
  } else {
    // SECURITY: same default as Supabase path — no whitelist means NO services
    // are exposed publicly. Never dump the full catalog.
    services = []
  }

  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    phone: clinic.phone ?? null,
    address: clinic.address ?? null,
    booking_config: {
      ...bookingConfig,
      // Don't expose internal settings
      enabled: true,
    },
    services,
  }
}

interface RouteParams {
  params: {
    slug: string
  }
}

interface BookingConfig {
  enabled: boolean
  allow_new_patients: boolean
  require_phone: boolean
  require_notes: boolean
  max_advance_days: number
  min_advance_hours: number
  slot_duration_minutes: number
  working_hours: Record<string, { start: string; end: string } | null>
  buffer_minutes: number
  welcome_message: string | null
  confirmation_message: string | null
}

interface PublicClinicResponse {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  booking_config: BookingConfig
  services: {
    id: string
    name: string
    description: string | null
    price_cents: number
    duration_minutes: number
    category: string | null
  }[]
}

/**
 * GET /api/public/clinic/[slug]
 * Public endpoint - No authentication required
 * Returns clinic info and available services for booking
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { slug } = params

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }

    if (shouldReturnConvexData('public_booking_services')) {
      const result = await getPublicClinicFromConvex(slug)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ data: result })
    }

    // Fetch clinic by slug
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select(`
        id,
        name,
        slug,
        phone,
        address,
        booking_config
      `)
      .eq('slug', slug)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      )
    }

    // Check if booking is enabled
    const bookingConfig = clinic.booking_config as BookingConfig
    if (!bookingConfig?.enabled) {
      return NextResponse.json(
        { error: 'Online booking is not enabled for this clinic' },
        { status: 403 }
      )
    }

    // Get services available for booking
    // First check if there's a whitelist
    const { data: whitelistedServices } = await supabaseAdmin
      .from('public_booking_services')
      .select(`
        service_id,
        custom_duration_minutes,
        display_order,
        services:services!public_booking_services_service_id_fkey (
          id,
          name,
          description,
          price_cents,
          est_minutes,
          category
        )
      `)
      .eq('clinic_id', clinic.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    let services: PublicClinicResponse['services'] = []

    if (whitelistedServices && whitelistedServices.length > 0) {
      // Use whitelist
      services = whitelistedServices.map((ws: any) => ({
        id: ws.services.id,
        name: ws.services.name,
        description: ws.services.description,
        price_cents: ws.services.price_cents,
        duration_minutes: ws.custom_duration_minutes || ws.services.est_minutes || bookingConfig.slot_duration_minutes,
        category: ws.services.category
      }))
    } else {
      // SECURITY: a missing whitelist used to dump every active service
      // (with prices) for any clinic addressable by slug. Combined with
      // unauthenticated slug enumeration that meant competitors could
      // scrape full price lists. Default to an empty list — owners must
      // explicitly publish services via the public_booking_services
      // whitelist before they appear on the booking page.
      services = []
    }

    const response: PublicClinicResponse = {
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      phone: clinic.phone,
      address: clinic.address,
      booking_config: {
        ...bookingConfig,
        // Don't expose internal settings
        enabled: true
      },
      services
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching public clinic:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
