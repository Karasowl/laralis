import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Appointment, checkConflicts } from './conflict-detection'

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
  const baseQuery = () => supabaseAdmin
    .from('treatments')
    .eq('clinic_id', clinicId)
    .eq('treatment_date', date)
    .in('status', ['pending', 'scheduled', 'in_progress'])
    .not('treatment_time', 'is', null)

  const primary = await baseQuery().select(treatmentSelectWithDuration)

  if (!primary.error) return primary.data || []

  if (primary.error.code !== '42703') throw primary.error

  const legacy = await baseQuery().select(treatmentSelectWithLegacyMinutes)

  if (legacy.error) throw legacy.error

  return legacy.data || []
}

export async function fetchExistingScheduleAppointments({
  clinicId,
  date,
}: ExistingAppointmentParams): Promise<Appointment[]> {
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
