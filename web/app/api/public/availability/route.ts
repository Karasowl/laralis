import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
