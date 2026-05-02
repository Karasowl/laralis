/**
 * Conflict Detection for Dental Appointments
 *
 * Detects time conflicts between appointments in the calendar.
 * A conflict occurs when two appointments overlap in time.
 */

export interface Appointment {
  id: string
  treatment_date: string
  treatment_time: string | null
  duration_minutes: number
  patient_name?: string
  service_name?: string
}

export interface ConflictResult {
  hasConflict: boolean
  conflicts: ConflictDetail[]
}

export interface ConflictDetail {
  appointmentId: string
  patientName: string
  serviceName: string
  startTime: string
  endTime: string
  overlapMinutes: number
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/**
 * Check if two time ranges overlap
 * Returns overlap in minutes (0 if no overlap)
 */
function getOverlapMinutes(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): number {
  const overlapStart = Math.max(start1, start2)
  const overlapEnd = Math.min(end1, end2)
  return Math.max(0, overlapEnd - overlapStart)
}

/**
 * Check for conflicts with a proposed appointment
 *
 * @param proposed - The proposed appointment to check
 * @param existing - List of existing appointments on the same date
 * @param excludeId - Optional ID to exclude (useful when editing)
 * @returns ConflictResult with details about any conflicts found
 */
export function checkConflicts(
  proposed: {
    date: string
    time: string
    duration_minutes: number
  },
  existing: Appointment[],
  excludeId?: string
): ConflictResult {
  const conflicts: ConflictDetail[] = []

  if (!proposed.time) {
    return { hasConflict: false, conflicts: [] }
  }

  const proposedStart = parseTimeToMinutes(proposed.time)
  const proposedEnd = proposedStart + proposed.duration_minutes

  // Filter appointments for the same date
  const sameDayAppointments = existing.filter(
    (apt) => apt.treatment_date === proposed.date && apt.id !== excludeId && apt.treatment_time
  )

  for (const apt of sameDayAppointments) {
    if (!apt.treatment_time) continue

    const aptStart = parseTimeToMinutes(apt.treatment_time)
    const aptEnd = aptStart + apt.duration_minutes

    const overlapMinutes = getOverlapMinutes(proposedStart, proposedEnd, aptStart, aptEnd)

    if (overlapMinutes > 0) {
      conflicts.push({
        appointmentId: apt.id,
        patientName: apt.patient_name || 'Unknown',
        serviceName: apt.service_name || 'Unknown',
        startTime: apt.treatment_time,
        endTime: minutesToTime(aptEnd),
        overlapMinutes,
      })
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}

/**
 * Find all conflicts for a list of appointments on a given date
 * Useful for highlighting conflicts in the calendar view
 *
 * @param appointments - All appointments to check
 * @param date - The date to check for conflicts
 * @returns Map of appointment IDs to their conflicting appointment IDs
 */
export function findAllConflictsForDate(
  appointments: Appointment[],
  date: string
): Map<string, string[]> {
  const conflictMap = new Map<string, string[]>()

  const dayAppointments = appointments.filter(
    (apt) => apt.treatment_date === date && apt.treatment_time
  )

  for (let i = 0; i < dayAppointments.length; i++) {
    const apt1 = dayAppointments[i]
    if (!apt1.treatment_time) continue

    const start1 = parseTimeToMinutes(apt1.treatment_time)
    const end1 = start1 + apt1.duration_minutes

    for (let j = i + 1; j < dayAppointments.length; j++) {
      const apt2 = dayAppointments[j]
      if (!apt2.treatment_time) continue

      const start2 = parseTimeToMinutes(apt2.treatment_time)
      const end2 = start2 + apt2.duration_minutes

      const overlapMinutes = getOverlapMinutes(start1, end1, start2, end2)

      if (overlapMinutes > 0) {
        // Add conflict for apt1
        const conflicts1 = conflictMap.get(apt1.id) || []
        conflicts1.push(apt2.id)
        conflictMap.set(apt1.id, conflicts1)

        // Add conflict for apt2
        const conflicts2 = conflictMap.get(apt2.id) || []
        conflicts2.push(apt1.id)
        conflictMap.set(apt2.id, conflicts2)
      }
    }
  }

  return conflictMap
}

/**
 * Get a human-readable conflict message
 */
export function getConflictMessage(
  conflicts: ConflictDetail[],
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (conflicts.length === 0) return ''

  if (conflicts.length === 1) {
    const c = conflicts[0]
    return t('calendar.conflictSingle', {
      patient: c.patientName,
      time: c.startTime,
      overlap: c.overlapMinutes,
    })
  }

  return t('calendar.conflictMultiple', { count: conflicts.length })
}
