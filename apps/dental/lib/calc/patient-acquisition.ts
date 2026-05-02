import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Returns a map of `patientId -> ISO date (YYYY-MM-DD)` of that patient's
 * earliest non-cancelled treatment for the given clinic.
 *
 * The dashboard marketing analytics treat "new patient" as the date of
 * the patient's FIRST treatment (the moment they actually showed up),
 * NOT `patients.created_at` (which fires when a record is entered into
 * the system, often well before — or without ever — a real visit).
 *
 * Patients with no treatments are simply absent from the map: callers
 * will naturally exclude them from "new patients in period" counts.
 */
export async function getFirstTreatmentDateByPatient(
  clinicId: string,
  options: { patientIds?: string[] } = {}
): Promise<Map<string, string>> {
  let query = supabaseAdmin
    .from('treatments')
    .select('patient_id, treatment_date')
    .eq('clinic_id', clinicId)
    .not('treatment_date', 'is', null)
    .neq('status', 'cancelled')

  if (options.patientIds && options.patientIds.length > 0) {
    query = query.in('patient_id', options.patientIds)
  }

  const { data, error } = await query
  if (error) throw error

  const firstDate = new Map<string, string>()
  for (const t of (data || []) as Array<{ patient_id: string; treatment_date: string }>) {
    const pid = t.patient_id
    const iso = (t.treatment_date || '').slice(0, 10)
    if (!iso) continue
    const existing = firstDate.get(pid)
    if (!existing || iso < existing) firstDate.set(pid, iso)
  }
  return firstDate
}

/**
 * Convenience: returns the set of patient ids whose first treatment date
 * falls inside the inclusive [startIso, endIso] range.
 */
export function patientsAcquiredInRange(
  firstDateByPatient: Map<string, string>,
  startIso: string,
  endIso: string
): Set<string> {
  const acquired = new Set<string>()
  firstDateByPatient.forEach((firstIso, pid) => {
    if (firstIso >= startIso && firstIso <= endIso) acquired.add(pid)
  })
  return acquired
}
