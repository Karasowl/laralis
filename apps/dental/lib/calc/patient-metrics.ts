interface PatientTreatmentSnapshot {
  patient_id?: string | null
  treatment_date?: string | null
  status?: string | null
}

export function countUniqueCompletedPatientsInRange(
  treatments: PatientTreatmentSnapshot[],
  startDate: string,
  endDate: string
): number {
  return new Set(
    treatments
      .filter((treatment) => {
        const treatmentDate = String(treatment.treatment_date || '')
        return treatment.status === 'completed'
          && treatmentDate >= startDate
          && treatmentDate <= endDate
      })
      .map((treatment) => treatment.patient_id)
      .filter((patientId): patientId is string => Boolean(patientId))
  ).size
}
