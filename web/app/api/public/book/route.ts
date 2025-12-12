import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { sendBookingConfirmation } from '@/lib/email/service'
import { sendBookingReceivedWhatsApp } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const bookingSchema = z.object({
  clinic_id: z.string().uuid(),
  service_id: z.string().uuid(),
  patient_name: z.string().min(2).max(255),
  patient_email: z.string().email().optional().nullable(),
  patient_phone: z.string().min(7).max(50).optional().nullable(),
  patient_notes: z.string().max(1000).optional().nullable(),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requested_time: z.string().regex(/^\d{2}:\d{2}$/),
  utm_source: z.string().max(100).optional().nullable(),
  utm_medium: z.string().max(100).optional().nullable(),
  utm_campaign: z.string().max(100).optional().nullable()
})

interface BookingConfig {
  enabled: boolean
  allow_new_patients: boolean
  require_phone: boolean
  require_notes: boolean
  max_advance_days: number
  min_advance_hours: number
  slot_duration_minutes: number
}

/**
 * POST /api/public/book
 * Public endpoint - No authentication required
 * Creates a new booking request
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()

    // Validate input
    const validation = bookingSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get clinic config
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, name, booking_config, notification_settings')
      .eq('id', data.clinic_id)
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

    // Check required fields based on config
    if (config.require_phone && !data.patient_phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    if (config.require_notes && !data.patient_notes) {
      return NextResponse.json(
        { error: 'Notes are required' },
        { status: 400 }
      )
    }

    // Verify service exists and is bookable
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, name, is_active')
      .eq('id', data.service_id)
      .eq('clinic_id', data.clinic_id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    if (!service.is_active) {
      return NextResponse.json(
        { error: 'This service is not available for booking' },
        { status: 400 }
      )
    }

    // Validate date/time
    const today = new Date()
    const requestedDateTime = new Date(`${data.requested_date}T${data.requested_time}`)

    const minDateTime = new Date(today)
    minDateTime.setHours(minDateTime.getHours() + (config.min_advance_hours || 2))

    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + (config.max_advance_days || 30))

    if (requestedDateTime < minDateTime) {
      return NextResponse.json(
        { error: 'Please select a time at least 2 hours in advance' },
        { status: 400 }
      )
    }

    if (requestedDateTime > maxDate) {
      return NextResponse.json(
        { error: `Cannot book more than ${config.max_advance_days} days in advance` },
        { status: 400 }
      )
    }

    // Check slot availability using the database function
    const { data: isAvailable, error: availError } = await supabaseAdmin
      .rpc('check_booking_slot_availability', {
        p_clinic_id: data.clinic_id,
        p_date: data.requested_date,
        p_time: data.requested_time,
        p_duration_minutes: config.slot_duration_minutes || 30
      })

    if (availError) {
      console.error('Error checking availability:', availError)
      return NextResponse.json(
        { error: 'Failed to check availability' },
        { status: 500 }
      )
    }

    if (!isAvailable) {
      return NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      )
    }

    // Check for existing patient by email or phone
    let patientId: string | null = null
    if (data.patient_email || data.patient_phone) {
      let patientQuery = supabaseAdmin
        .from('patients')
        .select('id')
        .eq('clinic_id', data.clinic_id)

      if (data.patient_email) {
        patientQuery = patientQuery.eq('email', data.patient_email)
      } else if (data.patient_phone) {
        patientQuery = patientQuery.eq('phone', data.patient_phone)
      }

      const { data: existingPatient } = await patientQuery.single()
      if (existingPatient) {
        patientId = existingPatient.id
      }
    }

    // Get request metadata
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const userAgent = request.headers.get('user-agent') || null
    const referrer = request.headers.get('referer') || null

    // Create the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('public_bookings')
      .insert({
        clinic_id: data.clinic_id,
        service_id: data.service_id,
        patient_name: data.patient_name,
        patient_email: data.patient_email || null,
        patient_phone: data.patient_phone || null,
        patient_notes: data.patient_notes || null,
        patient_id: patientId,
        requested_date: data.requested_date,
        requested_time: data.requested_time,
        status: 'pending',
        ip_address: ip,
        user_agent: userAgent,
        referrer: referrer,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // Send confirmation email if email provided
    if (data.patient_email) {
      try {
        await sendBookingConfirmation({
          clinicId: data.clinic_id,
          clinicName: clinic.name,
          patientName: data.patient_name,
          patientEmail: data.patient_email,
          serviceName: service.name,
          appointmentDate: data.requested_date,
          appointmentTime: data.requested_time,
          bookingId: booking.id
        })

        // Update booking to mark email sent
        await supabaseAdmin
          .from('public_bookings')
          .update({ confirmation_email_sent: true })
          .eq('id', booking.id)
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError)
        // Don't fail the booking if email fails
      }
    }

    // Send WhatsApp notification if phone provided
    if (data.patient_phone) {
      try {
        await sendBookingReceivedWhatsApp({
          clinicId: data.clinic_id,
          clinicName: clinic.name,
          patientName: data.patient_name,
          patientPhone: data.patient_phone,
          publicBookingId: booking.id,
          serviceName: service.name,
          requestedDate: data.requested_date,
          requestedTime: data.requested_time
        })
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp notification:', whatsappError)
        // Don't fail the booking if WhatsApp fails
      }
    }

    return NextResponse.json({
      data: {
        id: booking.id,
        status: booking.status,
        requested_date: booking.requested_date,
        requested_time: booking.requested_time,
        service_name: service.name,
        clinic_name: clinic.name
      },
      message: 'Booking request submitted successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing booking:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
