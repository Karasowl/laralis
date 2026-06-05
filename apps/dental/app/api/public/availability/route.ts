import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

// QA route contract: @qa-public-route public booking availability lookup.
export const dynamic = 'force-dynamic'

interface BookingConfig {
  enabled: boolean
  max_advance_days: number
  min_advance_hours: number
  slot_duration_minutes: number
  working_hours: Record<string, { start: string; end: string } | null>
  buffer_minutes: number
}

interface TimeSlot {
  time: string
  available: boolean
}

interface AvailabilityResponse {
  date: string
  slots: TimeSlot[]
}

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

/**
 * Convex read branch for availability. Reassembles the same data the Supabase
 * path reads (clinic booking_config, optional service duration, blocked slots,
 * booked treatments, pending public bookings) and runs the identical slot
 * generation logic so the response shape is byte-identical.
 *
 * Table scoping:
 * - `clinics` is keyed by `id` (PK), NOT `clinic_id`, so it must be fetched via
 *   listConvexTable + JS filter. listByClinic would silently return zero rows.
 * - `services` rows are looked up by `id`, so they also use listConvexTable + filter.
 * - public_booking_services, booking_blocked_slots, treatments, public_bookings
 *   all carry a `clinic_id` column, so they use listByClinic.
 */
async function getAvailabilityFromConvex(
  clinicId: string,
  dateStr: string,
  serviceId: string | null
): Promise<NextResponse> {
  // Clinic lookup by id (PK) — clinics table has no clinic_id column.
  const clinics = await listConvexTable('clinics', 10000) as ImportedRecord[]
  const clinicRow = clinics.find((row) => row.id === clinicId || row.legacyId === clinicId)
  const clinic = normalizeConvexRecord(clinicRow)

  if (!clinic) {
    return NextResponse.json(
      { error: 'Clinic not found' },
      { status: 404 }
    )
  }

  const config = clinic.booking_config as BookingConfig
  if (!config?.enabled) {
    return NextResponse.json(
      { error: 'Online booking is not enabled for this clinic' },
      { status: 403 }
    )
  }

  // Get service duration if specified
  let slotDuration = config.slot_duration_minutes || 30
  if (serviceId) {
    // Check whitelist first (public_booking_services is clinic-scoped)
    const whitelistRows = await listConvexDocumentsByClinic('public_booking_services', clinicId, 10000) as ImportedRecord[]
    const whitelisted = whitelistRows.find(
      (row) => (row.service_id === serviceId) && row.is_active === true
    )

    if (whitelisted?.custom_duration_minutes) {
      slotDuration = whitelisted.custom_duration_minutes
    } else {
      // Get from service (services looked up by id, not clinic_id)
      const services = await listConvexTable('services', 10000) as ImportedRecord[]
      const service = services.find((row) => row.id === serviceId || row.legacyId === serviceId)

      if (service?.est_minutes) {
        slotDuration = service.est_minutes
      }
    }
  }

  // Check if date is within allowed range
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const requestedDate = new Date(dateStr)
  requestedDate.setHours(0, 0, 0, 0)

  const minDate = new Date(today)
  minDate.setHours(minDate.getHours() + (config.min_advance_hours || 2))

  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + (config.max_advance_days || 30))

  if (requestedDate < today) {
    return NextResponse.json(
      { error: 'Cannot book appointments in the past' },
      { status: 400 }
    )
  }

  if (requestedDate > maxDate) {
    return NextResponse.json(
      { error: `Cannot book more than ${config.max_advance_days} days in advance` },
      { status: 400 }
    )
  }

  // Get day of week
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayOfWeek = dayNames[requestedDate.getDay()]
  const dayConfig = config.working_hours?.[dayOfWeek]

  if (!dayConfig) {
    // Clinic is closed on this day
    return NextResponse.json({
      data: {
        date: dateStr,
        slots: []
      }
    })
  }

  // Generate time slots
  const slots: TimeSlot[] = []
  const [startHour, startMin] = dayConfig.start.split(':').map(Number)
  const [endHour, endMin] = dayConfig.end.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  const bufferMinutes = config.buffer_minutes || 0

  // Get blocked slots for this date (booking_blocked_slots is clinic-scoped)
  const blockedRows = await listConvexDocumentsByClinic('booking_blocked_slots', clinicId, 10000) as ImportedRecord[]
  const blockedSlots = blockedRows
    .filter((row) => row.blocked_date === dateStr)
    .map((row) => ({ start_time: row.start_time, end_time: row.end_time }))

  // Get existing treatments for this date (treatments is clinic-scoped)
  const treatmentRows = await listConvexDocumentsByClinic('treatments', clinicId, 10000) as ImportedRecord[]
  const existingTreatments = treatmentRows
    .filter((row) =>
      row.treatment_date === dateStr &&
      (row.status === 'scheduled' || row.status === 'in_progress') &&
      row.treatment_time != null
    )
    .map((row) => ({ treatment_time: row.treatment_time, duration_minutes: row.duration_minutes }))

  // Get pending public bookings for this date (public_bookings is clinic-scoped)
  const bookingRows = await listConvexDocumentsByClinic('public_bookings', clinicId, 10000) as ImportedRecord[]
  const pendingBookings = bookingRows
    .filter((row) => row.requested_date === dateStr && row.status === 'pending')
    .map((row) => ({ requested_time: row.requested_time }))

  // Generate slots
  for (let mins = startMinutes; mins + slotDuration <= endMinutes; mins += slotDuration + bufferMinutes) {
    const hour = Math.floor(mins / 60)
    const minute = mins % 60
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    const slotEndMins = mins + slotDuration

    // Check if this slot is available
    let available = true

    // Check blocked slots
    if (blockedSlots?.some(bs => {
      if (!bs.start_time) return true // Entire day blocked
      const [bsHour, bsMin] = bs.start_time.split(':').map(Number)
      const [beHour, beMin] = bs.end_time.split(':').map(Number)
      const bsMinutes = bsHour * 60 + bsMin
      const beMinutes = beHour * 60 + beMin
      return (mins >= bsMinutes && mins < beMinutes) || (slotEndMins > bsMinutes && slotEndMins <= beMinutes)
    })) {
      available = false
    }

    // Check existing treatments
    if (available && existingTreatments?.some(t => {
      const [tHour, tMin] = t.treatment_time.split(':').map(Number)
      const tMinutes = tHour * 60 + tMin
      const tEndMinutes = tMinutes + (t.duration_minutes || 30)
      return (mins >= tMinutes && mins < tEndMinutes) || (slotEndMins > tMinutes && slotEndMins <= tEndMinutes)
    })) {
      available = false
    }

    // Check pending bookings
    if (available && pendingBookings?.some(pb => {
      const [pbHour, pbMin] = pb.requested_time.split(':').map(Number)
      const pbMinutes = pbHour * 60 + pbMin
      const pbEndMinutes = pbMinutes + slotDuration
      return (mins >= pbMinutes && mins < pbEndMinutes) || (slotEndMins > pbMinutes && slotEndMins <= pbEndMinutes)
    })) {
      available = false
    }

    // For today, check minimum advance hours
    if (available && dateStr === today.toISOString().split('T')[0]) {
      const now = new Date()
      const slotDate = new Date(dateStr)
      slotDate.setHours(hour, minute, 0, 0)
      const minAdvanceDate = new Date(now)
      minAdvanceDate.setHours(minAdvanceDate.getHours() + (config.min_advance_hours || 2))

      if (slotDate < minAdvanceDate) {
        available = false
      }
    }

    slots.push({ time: timeStr, available })
  }

  const response: AvailabilityResponse = {
    date: dateStr,
    slots
  }

  return NextResponse.json({ data: response })
}

/**
 * GET /api/public/availability
 * Public endpoint - No authentication required
 * Returns available time slots for a given clinic and date
 *
 * Query params:
 * - clinic_id: UUID of the clinic
 * - date: Date in YYYY-MM-DD format
 * - service_id: (optional) UUID of the service to book
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinic_id')
    const dateStr = searchParams.get('date')
    const serviceId = searchParams.get('service_id')

    if (!clinicId || !dateStr) {
      return NextResponse.json(
        { error: 'clinic_id and date are required' },
        { status: 400 }
      )
    }

    // Validate date format
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // PUBLIC route: no auth guard (preserved). Convex read branch exposes only
    // the same availability fields ({ date, slots }) — no widened exposure.
    if (shouldReturnConvexData('clinics')) {
      return getAvailabilityFromConvex(clinicId, dateStr, serviceId)
    }

    // Get clinic booking config
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('booking_config')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      )
    }

    const config = clinic.booking_config as BookingConfig
    if (!config?.enabled) {
      return NextResponse.json(
        { error: 'Online booking is not enabled for this clinic' },
        { status: 403 }
      )
    }

    // Get service duration if specified
    let slotDuration = config.slot_duration_minutes || 30
    if (serviceId) {
      // Check whitelist first
      const { data: whitelisted } = await supabaseAdmin
        .from('public_booking_services')
        .select('custom_duration_minutes')
        .eq('clinic_id', clinicId)
        .eq('service_id', serviceId)
        .eq('is_active', true)
        .single()

      if (whitelisted?.custom_duration_minutes) {
        slotDuration = whitelisted.custom_duration_minutes
      } else {
        // Get from service
        const { data: service } = await supabaseAdmin
          .from('services')
          .select('est_minutes')
          .eq('id', serviceId)
          .single()

        if (service?.est_minutes) {
          slotDuration = service.est_minutes
        }
      }
    }

    // Check if date is within allowed range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const requestedDate = new Date(dateStr)
    requestedDate.setHours(0, 0, 0, 0)

    const minDate = new Date(today)
    minDate.setHours(minDate.getHours() + (config.min_advance_hours || 2))

    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + (config.max_advance_days || 30))

    if (requestedDate < today) {
      return NextResponse.json(
        { error: 'Cannot book appointments in the past' },
        { status: 400 }
      )
    }

    if (requestedDate > maxDate) {
      return NextResponse.json(
        { error: `Cannot book more than ${config.max_advance_days} days in advance` },
        { status: 400 }
      )
    }

    // Get day of week
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayOfWeek = dayNames[requestedDate.getDay()]
    const dayConfig = config.working_hours?.[dayOfWeek]

    if (!dayConfig) {
      // Clinic is closed on this day
      return NextResponse.json({
        data: {
          date: dateStr,
          slots: []
        }
      })
    }

    // Generate time slots
    const slots: TimeSlot[] = []
    const [startHour, startMin] = dayConfig.start.split(':').map(Number)
    const [endHour, endMin] = dayConfig.end.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    const bufferMinutes = config.buffer_minutes || 0

    // Get blocked slots for this date
    const { data: blockedSlots } = await supabaseAdmin
      .from('booking_blocked_slots')
      .select('start_time, end_time')
      .eq('clinic_id', clinicId)
      .eq('blocked_date', dateStr)

    // Get existing treatments for this date
    const { data: existingTreatments } = await supabaseAdmin
      .from('treatments')
      .select('treatment_time, duration_minutes')
      .eq('clinic_id', clinicId)
      .eq('treatment_date', dateStr)
      .in('status', ['scheduled', 'in_progress'])
      .not('treatment_time', 'is', null)

    // Get pending public bookings for this date
    const { data: pendingBookings } = await supabaseAdmin
      .from('public_bookings')
      .select('requested_time')
      .eq('clinic_id', clinicId)
      .eq('requested_date', dateStr)
      .eq('status', 'pending')

    // Generate slots
    for (let mins = startMinutes; mins + slotDuration <= endMinutes; mins += slotDuration + bufferMinutes) {
      const hour = Math.floor(mins / 60)
      const minute = mins % 60
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const slotEndMins = mins + slotDuration

      // Check if this slot is available
      let available = true

      // Check blocked slots
      if (blockedSlots?.some(bs => {
        if (!bs.start_time) return true // Entire day blocked
        const [bsHour, bsMin] = bs.start_time.split(':').map(Number)
        const [beHour, beMin] = bs.end_time.split(':').map(Number)
        const bsMinutes = bsHour * 60 + bsMin
        const beMinutes = beHour * 60 + beMin
        return (mins >= bsMinutes && mins < beMinutes) || (slotEndMins > bsMinutes && slotEndMins <= beMinutes)
      })) {
        available = false
      }

      // Check existing treatments
      if (available && existingTreatments?.some(t => {
        const [tHour, tMin] = t.treatment_time.split(':').map(Number)
        const tMinutes = tHour * 60 + tMin
        const tEndMinutes = tMinutes + (t.duration_minutes || 30)
        return (mins >= tMinutes && mins < tEndMinutes) || (slotEndMins > tMinutes && slotEndMins <= tEndMinutes)
      })) {
        available = false
      }

      // Check pending bookings
      if (available && pendingBookings?.some(pb => {
        const [pbHour, pbMin] = pb.requested_time.split(':').map(Number)
        const pbMinutes = pbHour * 60 + pbMin
        const pbEndMinutes = pbMinutes + slotDuration
        return (mins >= pbMinutes && mins < pbEndMinutes) || (slotEndMins > pbMinutes && slotEndMins <= pbEndMinutes)
      })) {
        available = false
      }

      // For today, check minimum advance hours
      if (available && dateStr === today.toISOString().split('T')[0]) {
        const now = new Date()
        const slotDate = new Date(dateStr)
        slotDate.setHours(hour, minute, 0, 0)
        const minAdvanceDate = new Date(now)
        minAdvanceDate.setHours(minAdvanceDate.getHours() + (config.min_advance_hours || 2))

        if (slotDate < minAdvanceDate) {
          available = false
        }
      }

      slots.push({ time: timeStr, available })
    }

    const response: AvailabilityResponse = {
      date: dateStr,
      slots
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
