import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { readJson } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const bookingActionSchema = z.object({
  clinic_id: z.string().uuid().optional(),
  action: z.enum(['confirm', 'reject']),
  rejection_reason: z.string().trim().max(500).optional().nullable(),
})

type MissingColumnError = {
  message?: string
}

function missingColumnFromError(error: MissingColumnError | null | undefined) {
  return error?.message?.match(/Could not find the '([^']+)' column/)?.[1] || null
}

async function insertOneTolerant(table: string, payload: Record<string, unknown>) {
  let row = { ...payload }
  let result = await (supabaseAdmin as any)
    .from(table)
    .insert(row)
    .select()
    .single()

  for (let attempt = 0; result.error && attempt < 8; attempt += 1) {
    const missingColumn = missingColumnFromError(result.error)
    if (!missingColumn || !(missingColumn in row)) break

    const { [missingColumn]: _removed, ...nextRow } = row
    row = nextRow
    result = await (supabaseAdmin as any)
      .from(table)
      .insert(row)
      .select()
      .single()
  }

  if (result.error || !result.data) {
    throw new Error(`Could not insert ${table}: ${result.error?.message || 'missing row'}`)
  }

  return result.data as any
}

function splitPatientName(patientName: string) {
  const parts = patientName.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || 'Paciente',
    lastName: parts.slice(1).join(' ') || 'Booking',
  }
}

function normalizeTime(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 5) : null
}

async function resolveBookingPatient(booking: any, clinicId: string) {
  if (booking.patient_id) return booking.patient_id as string

  if (booking.patient_email || booking.patient_phone) {
    let query = supabaseAdmin
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)

    if (booking.patient_email) {
      query = query.eq('email', booking.patient_email)
    } else {
      query = query.eq('phone', booking.patient_phone)
    }

    const { data: existing, error } = await query.maybeSingle()
    if (error) throw error
    if (existing?.id) return existing.id as string
  }

  const { firstName, lastName } = splitPatientName(booking.patient_name)
  const patient = await insertOneTolerant('patients', {
    clinic_id: clinicId,
    first_name: firstName,
    last_name: lastName,
    email: booking.patient_email || null,
    phone: booking.patient_phone || null,
    notes: booking.patient_notes || null,
    first_visit_date: booking.requested_date,
    acquisition_date: booking.requested_date,
  })

  return patient.id as string
}

async function confirmBooking(params: {
  booking: any
  clinicId: string
  userId: string
}) {
  const { booking, clinicId, userId } = params
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending booking requests can be confirmed' }, { status: 409 })
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('id, name, est_minutes, price_cents, variable_cost_cents, margin_pct')
    .eq('clinic_id', clinicId)
    .eq('id', booking.service_id)
    .single()

  if (serviceError || !service?.id) {
    return NextResponse.json({ error: 'Booking service was not found' }, { status: 404 })
  }

  const patientId = await resolveBookingPatient(booking, clinicId)
  const durationMinutes = Number(service.est_minutes || 30)
  const priceCents = Number(service.price_cents || 0)

  const treatment = await insertOneTolerant('treatments', {
    clinic_id: clinicId,
    patient_id: patientId,
    service_id: service.id,
    treatment_date: booking.requested_date,
    treatment_time: normalizeTime(booking.requested_time),
    duration_minutes: durationMinutes,
    minutes: durationMinutes,
    fixed_cost_per_minute_cents: 0,
    fixed_per_minute_cents: 0,
    variable_cost_cents: Number(service.variable_cost_cents || 0),
    margin_pct: Number(service.margin_pct || 60),
    price_cents: priceCents,
    amount_paid_cents: 0,
    pending_balance_cents: priceCents,
    status: 'scheduled',
    notes: `Created from public booking ${booking.id} for ${booking.patient_name}`,
    snapshot_costs: {
      source: 'public_booking',
      public_booking_id: booking.id,
      service_name: service.name,
    },
  })

  const { data: updatedBooking, error: updateError } = await supabaseAdmin
    .from('public_bookings')
    .update({
      status: 'confirmed',
      patient_id: patientId,
      treatment_id: treatment.id,
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .eq('clinic_id', clinicId)
    .select()
    .single()

  if (updateError || !updatedBooking) throw updateError

  return NextResponse.json({
    data: updatedBooking,
    treatment,
    patient_id: patientId,
  })
}

async function rejectBooking(params: {
  booking: any
  clinicId: string
  rejectionReason?: string | null
}) {
  const { booking, clinicId, rejectionReason } = params
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending booking requests can be rejected' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('public_bookings')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .eq('clinic_id', clinicId)
    .select()
    .single()

  if (error || !data) throw error

  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }

    const parsed = bookingActionSchema.safeParse(bodyResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', '),
        },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const ctx = await resolveClinicContext({ requestedClinicId: parsed.data.clinic_id, cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }

    const { clinicId, userId } = ctx
    const requiredPermission = parsed.data.action === 'confirm' ? 'treatments.create' : 'treatments.edit'
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, requiredPermission)
    if (forbidden) return forbidden

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('public_bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    }

    if (booking.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    }

    if (parsed.data.action === 'confirm') {
      return confirmBooking({ booking, clinicId, userId })
    }

    return rejectBooking({
      booking,
      clinicId,
      rejectionReason: parsed.data.rejection_reason,
    })
  } catch (error) {
    console.error('bookings.patch error', error)
    return NextResponse.json({ error: 'Failed to update booking request' }, { status: 500 })
  }
}
