import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { readJson } from '@/lib/validation'
import { checkScheduleConflicts } from '@/lib/calendar/server-conflicts'
import { checkConflicts, type Appointment } from '@/lib/calendar/conflict-detection'
import { deriveTreatmentPaymentState } from '@/lib/calc/treatment-payment'
import { sendAllTreatmentCreatedNotifications } from '@/lib/sms/service'
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  patchConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

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

  const durationMinutes = Number(service.est_minutes || 30)
  const priceCents = Number(service.price_cents || 0)
  const conflictResult = await checkScheduleConflicts({
    clinicId,
    date: booking.requested_date,
    time: normalizeTime(booking.requested_time) || '12:00',
    durationMinutes,
    excludeId: `public_booking:${booking.id}`,
  })

  if (conflictResult.hasConflict) {
    return NextResponse.json(
      {
        error: 'appointment_conflict',
        message: 'This booking request conflicts with an existing appointment or booking request.',
        conflicts: conflictResult.conflicts,
      },
      { status: 409 }
    )
  }

  const patientId = await resolveBookingPatient(booking, clinicId)

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

  // Notify the patient now, not when the request came in. The public booking
  // endpoint deliberately does not message the contact details it was handed
  // (they are unauthenticated input, see shouldDispatchToRequester in
  // app/api/public/book/route.ts), so confirmation is the first point where a
  // human has vetted the request. This also brings the flow in line with
  // POST /api/treatments, which already notifies on appointment creation while
  // confirming a public booking silently created one.
  let notificationSent = false
  try {
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single()

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('first_name, last_name, phone')
      .eq('id', patientId)
      .single()

    if (clinic && patient?.phone) {
      const results = await sendAllTreatmentCreatedNotifications({
        clinicId,
        clinicName: clinic.name,
        patientName: `${patient.first_name} ${patient.last_name}`.trim(),
        patientPhone: patient.phone,
        patientId,
        treatmentId: treatment.id,
        serviceName: service.name,
        appointmentDate: booking.requested_date,
        appointmentTime: normalizeTime(booking.requested_time) || '12:00',
      })
      notificationSent = results.patient.success || results.staff.primary.success
    }
  } catch (notificationError) {
    // Best-effort: a failed notification must not roll back a confirmed appointment.
    console.warn('[bookings confirm] Failed to send notifications:', notificationError)
  }

  return NextResponse.json({
    data: updatedBooking,
    treatment,
    patient_id: patientId,
    notification_sent: notificationSent,
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

/**
 * Convex port of checkScheduleConflicts for the public-booking confirm path.
 * Supabase is unreachable in convex-only mode, so we read the same two sources
 * (treatments + public_bookings on the requested date) from Convex and run the
 * identical pure checkConflicts() the Supabase path uses via server-conflicts.
 * Mirrors fetchExistingScheduleAppointments():
 *  - treatments: status in ('pending','scheduled','in_progress') AND treatment_time not null
 *  - public_bookings: status in ('pending','confirmed') AND treatment_id is null
 *    (booking id prefixed `public_booking:` so excludeId can drop the booking itself)
 */
async function convexScheduleConflicts(params: {
  clinicId: string
  date: string
  time: string
  durationMinutes: number
  excludeId?: string
}) {
  const [treatments, bookings, services] = await Promise.all([
    listConvexDocumentsByClinic('treatments', params.clinicId, 5000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('public_bookings', params.clinicId, 5000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', params.clinicId, 1000) as Promise<ImportedRecord[]>,
  ])

  const servicesById = new Map(
    services.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
      return ids.map((id) => [id, row] as const)
    })
  )

  const treatmentAppointments: Appointment[] = treatments
    .filter((t) =>
      t.treatment_date === params.date &&
      normalizeTime(t.treatment_time) != null &&
      ['pending', 'scheduled', 'in_progress'].includes(String(t.status))
    )
    .map((t) => ({
      id: String(t.id ?? t.legacyId),
      treatment_date: t.treatment_date,
      treatment_time: normalizeTime(t.treatment_time),
      duration_minutes: Number(t.duration_minutes || t.minutes || 30),
      patient_name: undefined,
      service_name: undefined,
    }))

  const bookingAppointments: Appointment[] = bookings
    .filter((b) =>
      b.requested_date === params.date &&
      ['pending', 'confirmed'].includes(String(b.status)) &&
      (b.treatment_id === null || b.treatment_id === undefined)
    )
    .map((b) => {
      const service = b.service_id ? servicesById.get(String(b.service_id)) : null
      return {
        id: `public_booking:${b.id ?? b.legacyId}`,
        treatment_date: b.requested_date,
        treatment_time: normalizeTime(b.requested_time),
        duration_minutes: Number(service?.est_minutes || 30),
        patient_name: b.patient_name,
        service_name: service?.name,
      }
    })

  return checkConflicts(
    { date: params.date, time: params.time, duration_minutes: params.durationMinutes },
    [...treatmentAppointments, ...bookingAppointments],
    params.excludeId
  )
}

/**
 * Convex port of resolveBookingPatient: reuse the booking's linked patient,
 * else match an existing patient by email (preferred) or phone, else insert a
 * new patients row replicating the exact Supabase insert payload.
 */
async function resolveBookingPatientInConvex(booking: any, clinicId: string, now: string) {
  if (booking.patient_id) return booking.patient_id as string

  if (booking.patient_email || booking.patient_phone) {
    const patients = (await listConvexDocumentsByClinic('patients', clinicId, 5000)) as ImportedRecord[]
    const existing = patients.find((p) => {
      if (String(p.clinic_id) !== String(clinicId)) return false
      return booking.patient_email
        ? p.email === booking.patient_email
        : p.phone === booking.patient_phone
    })
    if (existing?.id || existing?.legacyId) return String(existing.id ?? existing.legacyId)
  }

  const { firstName, lastName } = splitPatientName(booking.patient_name)
  const patientId = crypto.randomUUID()
  await upsertConvexDocumentByLegacyId('patients', patientId, {
    id: patientId,
    clinic_id: clinicId,
    first_name: firstName,
    last_name: lastName,
    email: booking.patient_email || null,
    phone: booking.patient_phone || null,
    notes: booking.patient_notes || null,
    first_visit_date: booking.requested_date,
    acquisition_date: booking.requested_date,
    created_at: now,
    updated_at: now,
  })

  return patientId
}

/**
 * Convex-only port of confirmBooking. Replicates EVERY Supabase write the
 * Supabase confirm path performs: (1) read service, (2) conflict check,
 * (3) resolve/insert patient, (4) insert treatment, (5) update public_bookings.
 * Money stays in integer cents. is_paid is stamped here because Convex has no
 * calculate_treatment_is_paid trigger.
 */
async function confirmBookingInConvex(params: {
  booking: any
  clinicId: string
  userId: string
}) {
  const { booking, clinicId, userId } = params
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending booking requests can be confirmed' }, { status: 409 })
  }

  const services = (await listConvexDocumentsByClinic('services', clinicId, 1000)) as ImportedRecord[]
  const service = services.find(
    (s) =>
      (String(s.id) === String(booking.service_id) || String(s.legacyId) === String(booking.service_id)) &&
      String(s.clinic_id) === String(clinicId)
  )
  if (!service || (!service.id && !service.legacyId)) {
    return NextResponse.json({ error: 'Booking service was not found' }, { status: 404 })
  }
  const serviceId = String(service.id ?? service.legacyId)

  const durationMinutes = Number(service.est_minutes || 30)
  const priceCents = Number(service.price_cents || 0)
  const conflictResult = await convexScheduleConflicts({
    clinicId,
    date: booking.requested_date,
    time: normalizeTime(booking.requested_time) || '12:00',
    durationMinutes,
    excludeId: `public_booking:${booking.id}`,
  })

  if (conflictResult.hasConflict) {
    return NextResponse.json(
      {
        error: 'appointment_conflict',
        message: 'This booking request conflicts with an existing appointment or booking request.',
        conflicts: conflictResult.conflicts,
      },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  const patientId = await resolveBookingPatientInConvex(booking, clinicId, now)

  const treatmentId = crypto.randomUUID()
  // Mirror the Supabase insert payload exactly (fixed cost per minute is
  // hardcoded to 0 on this booking path, NOT derived). is_paid follows the
  // calculate_treatment_is_paid trigger: pending == priceCents (>0 when priced)
  // and status 'scheduled' => not paid.
  const { pendingBalanceCents, isPaid } = deriveTreatmentPaymentState({
    pendingBalanceCents: priceCents,
    status: 'scheduled',
  })
  const treatment = {
    id: treatmentId,
    clinic_id: clinicId,
    patient_id: patientId,
    service_id: serviceId,
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
    pending_balance_cents: pendingBalanceCents,
    is_paid: isPaid,
    status: 'scheduled',
    notes: `Created from public booking ${booking.id} for ${booking.patient_name}`,
    snapshot_costs: {
      source: 'public_booking',
      public_booking_id: booking.id,
      service_name: service.name,
    },
    created_at: now,
    updated_at: now,
  }
  await upsertConvexDocumentByLegacyId('treatments', treatmentId, treatment)

  const bookingPatch = {
    status: 'confirmed',
    patient_id: patientId,
    treatment_id: treatmentId,
    confirmed_at: now,
    confirmed_by: userId,
    updated_at: now,
  }
  await patchConvexDocumentByLegacyId('public_bookings', String(booking.id), bookingPatch)

  return NextResponse.json({
    data: { ...normalizeConvexRecord(booking), ...bookingPatch },
    treatment,
    patient_id: patientId,
  })
}

/**
 * Convex-only port of rejectBooking: single-table patch on public_bookings.
 */
async function rejectBookingInConvex(params: {
  booking: any
  clinicId: string
  rejectionReason?: string | null
}) {
  const { booking, rejectionReason } = params
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending booking requests can be rejected' }, { status: 409 })
  }

  const patch = {
    status: 'rejected',
    rejection_reason: rejectionReason || null,
    updated_at: new Date().toISOString(),
  }
  await patchConvexDocumentByLegacyId('public_bookings', String(booking.id), patch)

  return NextResponse.json({ data: { ...normalizeConvexRecord(booking), ...patch } })
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

    if (shouldUseConvexOnlyWritePath('public_bookings')) {
      const convexBooking = (await getConvexDocumentByLegacyId('public_bookings', params.id)) as ImportedRecord | null
      if (!convexBooking || convexBooking.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
      }

      if (parsed.data.action === 'confirm') {
        return confirmBookingInConvex({ booking: convexBooking, clinicId, userId })
      }

      return rejectBookingInConvex({
        booking: convexBooking,
        clinicId,
        rejectionReason: parsed.data.rejection_reason,
      })
    }

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
