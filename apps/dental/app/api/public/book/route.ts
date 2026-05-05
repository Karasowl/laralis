import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { isConfirmationEnabled, sendBookingConfirmation } from '@/lib/email/service'
import { sendBookingReceivedSMS } from '@/lib/sms'
import { sendBookingReceivedWhatsApp } from '@/lib/whatsapp'
import { readJson } from '@/lib/validation'

// QA route contract: @qa-public-route public booking request intake.
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

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

interface BookingConfig {
  enabled: boolean
  allow_new_patients: boolean
  require_phone: boolean
  require_notes: boolean
  max_advance_days: number
  min_advance_hours: number
  slot_duration_minutes: number
}

type NotificationChannel = 'email' | 'sms' | 'whatsapp'
type QaNotificationMode = 'mock' | 'fail' | null

interface NotificationResult {
  channel: NotificationChannel
  attempted: boolean
  mocked: boolean
  success: boolean
  error?: string
}

function qaNotificationMode(request: NextRequest): QaNotificationMode {
  const mode = request.headers.get('x-laralis-qa-notifications')
  const isStage = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes(STAGE_SUPABASE_REF)
  if (!isStage) return null
  return mode === 'mock' || mode === 'fail' ? mode : null
}

function isSmsBookingEnabled(notificationSettings: Record<string, any> | null): boolean {
  return notificationSettings?.sms?.enabled === true
}

function isWhatsAppBookingEnabled(notificationSettings: Record<string, any> | null): boolean {
  return notificationSettings?.whatsapp?.enabled === true
}

function bookingNotificationMessage(params: {
  clinicName: string
  patientName: string
  serviceName: string
  requestedDate: string
  requestedTime: string
}): string {
  return `Hola ${params.patientName}, recibimos tu solicitud de cita en ${params.clinicName}. Servicio: ${params.serviceName}. Fecha: ${params.requestedDate} ${params.requestedTime}.`
}

async function recordMockSmsNotification(params: {
  clinicId: string
  bookingId: string
  patientName: string
  patientPhone: string
  message: string
  success?: boolean
  error?: string
}): Promise<NotificationResult> {
  const success = params.success ?? true
  const { error } = await supabaseAdmin.from('sms_notifications').insert({
    clinic_id: params.clinicId,
    treatment_id: null,
    patient_id: null,
    public_booking_id: params.bookingId,
    notification_type: 'booking_received',
    recipient_phone: params.patientPhone,
    recipient_name: params.patientName,
    message_content: params.message,
    status: success ? 'sent' : 'failed',
    sent_at: success ? new Date().toISOString() : null,
    error_message: params.error || error?.message || null,
    provider: 'twilio',
    provider_message_id: success ? `qa-sms-${params.bookingId}` : null,
    cost_cents: 0
  })

  return {
    channel: 'sms',
    attempted: true,
    mocked: true,
    success: success && !error,
    error: error?.message || params.error
  }
}

async function recordMockWhatsAppNotification(params: {
  clinicId: string
  bookingId: string
  patientName: string
  patientPhone: string
  message: string
  success?: boolean
  error?: string
}): Promise<NotificationResult> {
  const success = params.success ?? true
  const { error } = await supabaseAdmin.from('whatsapp_notifications').insert({
    clinic_id: params.clinicId,
    treatment_id: null,
    patient_id: null,
    public_booking_id: params.bookingId,
    notification_type: 'booking_received',
    recipient_phone: params.patientPhone,
    recipient_name: params.patientName,
    message_content: params.message,
    template_id: null,
    status: success ? 'sent' : 'failed',
    sent_at: success ? new Date().toISOString() : null,
    error_message: params.error || error?.message || null,
    provider: 'twilio',
    provider_message_id: success ? `qa-whatsapp-${params.bookingId}` : null,
    cost_cents: 0
  })

  return {
    channel: 'whatsapp',
    attempted: true,
    mocked: true,
    success: success && !error,
    error: error?.message || params.error
  }
}

/**
 * POST /api/public/book
 * Public endpoint - No authentication required
 * Creates a new booking request
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const body = bodyResult.data

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
    const qaNotifications = qaNotificationMode(request)
    const mockNotifications = qaNotifications === 'mock'
    const forceFailedNotifications = qaNotifications === 'fail'

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
    const { data: publishedService, error: publishedServiceError } = await supabaseAdmin
      .from('public_booking_services')
      .select('service_id, custom_duration_minutes')
      .eq('clinic_id', data.clinic_id)
      .eq('service_id', data.service_id)
      .eq('is_active', true)
      .maybeSingle()

    if (publishedServiceError) {
      console.error('Error checking public booking service:', publishedServiceError)
      return NextResponse.json(
        { error: 'Failed to check service availability' },
        { status: 500 }
      )
    }

    if (!publishedService) {
      return NextResponse.json(
        { error: 'This service is not available for public booking' },
        { status: 404 }
      )
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, name, est_minutes, is_active')
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

    const serviceDurationMinutes =
      publishedService.custom_duration_minutes || service.est_minutes || config.slot_duration_minutes || 30

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
        p_duration_minutes: serviceDurationMinutes
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

    const notificationSettings = (clinic.notification_settings || null) as Record<string, any> | null
    const notificationResults: NotificationResult[] = []
    const message = bookingNotificationMessage({
      clinicName: clinic.name,
      patientName: data.patient_name,
      serviceName: service.name,
      requestedDate: data.requested_date,
      requestedTime: data.requested_time
    })

    // Send confirmation email if email provided and enabled
    if (data.patient_email && isConfirmationEnabled(notificationSettings)) {
      try {
        if (forceFailedNotifications) {
          notificationResults.push({
            channel: 'email',
            attempted: true,
            mocked: true,
            success: false,
            error: 'QA forced email failure'
          })
        } else if (!mockNotifications) {
          const result = await sendBookingConfirmation({
            clinicId: data.clinic_id,
            clinicName: clinic.name,
            patientName: data.patient_name,
            patientEmail: data.patient_email,
            serviceName: service.name,
            appointmentDate: data.requested_date,
            appointmentTime: data.requested_time,
            bookingId: booking.id
          })

          notificationResults.push({
            channel: 'email',
            attempted: true,
            mocked: false,
            success: result.success,
            error: result.error
          })
        } else {
          notificationResults.push({
            channel: 'email',
            attempted: true,
            mocked: true,
            success: true
          })
        }

        if (!forceFailedNotifications) {
          await supabaseAdmin
            .from('public_bookings')
            .update({ confirmation_email_sent: true })
            .eq('id', booking.id)
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError)
        notificationResults.push({
          channel: 'email',
          attempted: true,
          mocked: mockNotifications,
          success: false,
          error: emailError instanceof Error ? emailError.message : 'Unknown email error'
        })
        // Don't fail the booking if email fails
      }
    }

    // Send SMS notification if phone provided and enabled
    if (data.patient_phone && isSmsBookingEnabled(notificationSettings)) {
      try {
        if (mockNotifications || forceFailedNotifications) {
          notificationResults.push(await recordMockSmsNotification({
            clinicId: data.clinic_id,
            bookingId: booking.id,
            patientName: data.patient_name,
            patientPhone: data.patient_phone,
            message,
            success: !forceFailedNotifications,
            error: forceFailedNotifications ? 'QA forced SMS failure' : undefined
          }))
        } else {
          const result = await sendBookingReceivedSMS({
            clinicId: data.clinic_id,
            clinicName: clinic.name,
            patientName: data.patient_name,
            patientPhone: data.patient_phone,
            publicBookingId: booking.id,
            serviceName: service.name,
            requestedDate: data.requested_date,
            requestedTime: data.requested_time
          })

          notificationResults.push({
            channel: 'sms',
            attempted: true,
            mocked: false,
            success: result.success,
            error: result.error
          })
        }
      } catch (smsError) {
        console.error('Failed to send SMS notification:', smsError)
        notificationResults.push({
          channel: 'sms',
          attempted: true,
          mocked: mockNotifications,
          success: false,
          error: smsError instanceof Error ? smsError.message : 'Unknown SMS error'
        })
        // Don't fail the booking if SMS fails
      }
    }

    // Send WhatsApp notification if phone provided and enabled
    if (data.patient_phone && isWhatsAppBookingEnabled(notificationSettings)) {
      try {
        if (mockNotifications || forceFailedNotifications) {
          notificationResults.push(await recordMockWhatsAppNotification({
            clinicId: data.clinic_id,
            bookingId: booking.id,
            patientName: data.patient_name,
            patientPhone: data.patient_phone,
            message,
            success: !forceFailedNotifications,
            error: forceFailedNotifications ? 'QA forced WhatsApp failure' : undefined
          }))
        } else {
          const result = await sendBookingReceivedWhatsApp({
            clinicId: data.clinic_id,
            clinicName: clinic.name,
            patientName: data.patient_name,
            patientPhone: data.patient_phone,
            publicBookingId: booking.id,
            serviceName: service.name,
            requestedDate: data.requested_date,
            requestedTime: data.requested_time
          })

          notificationResults.push({
            channel: 'whatsapp',
            attempted: true,
            mocked: false,
            success: result.success,
            error: result.error
          })
        }
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp notification:', whatsappError)
        notificationResults.push({
          channel: 'whatsapp',
          attempted: true,
          mocked: mockNotifications,
          success: false,
          error: whatsappError instanceof Error ? whatsappError.message : 'Unknown WhatsApp error'
        })
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
        clinic_name: clinic.name,
        notification_results: notificationResults
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
