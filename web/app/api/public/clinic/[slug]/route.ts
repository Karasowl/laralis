import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

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
      // No whitelist - get all active services
      const { data: allServices } = await supabaseAdmin
        .from('services')
        .select(`
          id,
          name,
          description,
          price_cents,
          est_minutes,
          category
        `)
        .eq('clinic_id', clinic.id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (allServices) {
        services = allServices.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price_cents: s.price_cents,
          duration_minutes: s.est_minutes || bookingConfig.slot_duration_minutes,
          category: s.category
        }))
      }
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
