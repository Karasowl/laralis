import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Appointment, checkConflicts } from './conflict-detection'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

type ScheduleConflictParams = {
  clinicId: string
  date: string
  time: string
  durationMinutes: number
  excludeId?: string
}

type ExistingAppointmentParams = {
  clinicId: string
  date: string
}

type ConvexRow = Record<string, any>

const treatmentSelectWithDuration = `
  id,
  treatment_date,
  treatment_time,
  duration_minutes,
  patient:patients (first_name, last_name),
  service:services (name)
`

const treatmentSelectWithLegacyMinutes = `
  id,
  treatment_date,
  treatment_time,
  minutes,
  patient:patients (first_name, last_name),
  service:services (name)
`

function normalizeTime(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 5) : null
}

function relatedService(row: any) {
  if (Array.isArray(row?.service)) return row.service[0]
  return row?.service
}

async function fetchTreatmentsForConflicts({ clinicId, date }: ExistingAppointmentParams) {
  const query = (select: string) => supabaseAdmin
    .from('treatments')
    .select(select)
    .eq('clinic_id', clinicId)
    .eq('treatment_date', date)
    .in('status', ['pending', 'scheduled', 'in_progress'])
    .not('treatment_time', 'is', null)

  const primary = await query(treatmentSelectWithDuration)

  if (!primary.error) return primary.data || []

  if (primary.error.code !== '42703') throw primary.error

  const legacy = await query(treatmentSelectWithLegacyMinutes)

  if (legacy.error) throw legacy.error

  return legacy.data || []
}

/**
 * Convex port of fetchExistingScheduleAppointments. Supabase is unreachable in
 * convex-only mode (DATA_READ_BACKEND=convex), so we read the same two sources —
 * treatments + public_bookings for the requested date — from Convex and rebuild the
 * Appointment[] the pure checkConflicts() consumes. The Supabase path resolves
 * patient/service via PostgREST joins; Convex returns flat rows, so we fetch
 * patients + services for the clinic and join in memory (keyed by id and legacyId).
 * Filters mirror the Supabase query exactly:
 *  - treatments: treatment_date = date, status in (pending,scheduled,in_progress),
 *    treatment_time not null
 *  - public_bookings: requested_date = date, status in (pending,confirmed),
 *    treatment_id is null  (id prefixed `public_booking:` so excludeId can drop it)
 */
async function fetchExistingScheduleAppointmentsFromConvex({
  clinicId,
  date,
}: ExistingAppointmentParams): Promise<Appointment[]> {
  const [treatments, bookings, patients, services] = await Promise.all([
    listConvexDocumentsByClinic('treatments', clinicId, 5000) as Promise<ConvexRow[]>,
    listConvexDocumentsByClinic('public_bookings', clinicId, 5000) as Promise<ConvexRow[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ConvexRow[]>,
    listConvexDocumentsByClinic('services', clinicId, 1000) as Promise<ConvexRow[]>,
  ])

  const indexByIds = (rows: ConvexRow[]) =>
    new Map(
      rows.flatMap((row) =>
        [row.id, row.legacyId]
          .filter((id) => id != null)
          .map((id) => [String(id), row] as const)
      )
    )

  const patientsById = indexByIds(patients)
  const servicesById = indexByIds(services)

  const treatmentAppointments: Appointment[] = treatments
    .filter(
      (t) =>
        t.treatment_date === date &&
        normalizeTime(t.treatment_time) != null &&
        ['pending', 'scheduled', 'in_progress'].includes(String(t.status))
    )
    .map((t) => {
      const patient = t.patient_id ? patientsById.get(String(t.patient_id)) : null
      const service = t.service_id ? servicesById.get(String(t.service_id)) : null
      return {
        id: String(t.id ?? t.legacyId),
        treatment_date: t.treatment_date,
        treatment_time: normalizeTime(t.treatment_time),
        duration_minutes: Number(t.duration_minutes || t.minutes || 30),
        patient_name: patient
          ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || undefined
          : undefined,
        service_name: service?.name,
      }
    })

  const bookingAppointments: Appointment[] = bookings
    .filter(
      (b) =>
        b.requested_date === date &&
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

  return [...treatmentAppointments, ...bookingAppointments]
}

export async function fetchExistingScheduleAppointments({
  clinicId,
  date,
}: ExistingAppointmentParams): Promise<Appointment[]> {
  if (shouldReturnConvexData('treatments')) {
    return fetchExistingScheduleAppointmentsFromConvex({ clinicId, date })
  }

  const treatments = await fetchTreatmentsForConflicts({ clinicId, date })

  const { data: bookings, error: bookingError } = await supabaseAdmin
    .from('public_bookings')
    .select(`
      id,
      patient_name,
      requested_date,
      requested_time,
      service:services (name, est_minutes)
    `)
    .eq('clinic_id', clinicId)
    .eq('requested_date', date)
    .in('status', ['pending', 'confirmed'])
    .is('treatment_id', null)

  if (bookingError) throw bookingError

  const treatmentAppointments: Appointment[] = (treatments || []).map((t: any) => ({
    id: t.id,
    treatment_date: t.treatment_date,
    treatment_time: normalizeTime(t.treatment_time),
    duration_minutes: Number(t.duration_minutes || t.minutes || 30),
    patient_name: t.patient
      ? `${t.patient.first_name || ''} ${t.patient.last_name || ''}`.trim()
      : undefined,
    service_name: t.service?.name,
  }))

  const bookingAppointments: Appointment[] = (bookings || []).map((booking: any) => {
    const service = relatedService(booking)

    return {
      id: `public_booking:${booking.id}`,
      treatment_date: booking.requested_date,
      treatment_time: normalizeTime(booking.requested_time),
      duration_minutes: Number(service?.est_minutes || 30),
      patient_name: booking.patient_name,
      service_name: service?.name,
    }
  })

  return [...treatmentAppointments, ...bookingAppointments]
}

export async function checkScheduleConflicts({
  clinicId,
  date,
  time,
  durationMinutes,
  excludeId,
}: ScheduleConflictParams) {
  const appointments = await fetchExistingScheduleAppointments({ clinicId, date })

  return checkConflicts(
    {
      date,
      time,
      duration_minutes: durationMinutes,
    },
    appointments,
    excludeId
  )
}
