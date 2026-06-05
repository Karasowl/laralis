/**
 * Analytics: Patient Stats
 *
 * GET /api/analytics/patients/stats
 * Returns patient metrics and statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { verifyClinicAccess } from '@/lib/auth/verify-clinic-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

/**
 * Convex variant of the patient-stats aggregation.
 * Replicates the Supabase path EXACTLY:
 * - fetch patients + treatments separately (no relational join in Convex)
 * - same Date-object comparisons on first_visit_date (NOT lexicographic)
 * - same `.in('patient_id', patientIds)` semantics by filtering treatments to the
 *   set of date-filtered patient ids
 * - same `source_id || 'Unknown'` bucketing
 * - same avg rounding: Math.round(avg * 10) / 10
 */
async function getPatientStatsFromConvex(
  clinicId: string,
  startDate: string | null,
  endDate: string | null
) {
  const [convexPatients, convexTreatments] = await Promise.all([
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  // Mirror Supabase `.select('id, first_visit_date, source_id')`
  const allPatients = convexPatients.map((row) => {
    const { id, first_visit_date, source_id } = normalizeConvexRecord(row)
    return { id, first_visit_date, source_id }
  })

  // Filter by date if provided (Date-object comparison, identical to Supabase path)
  let patients = allPatients
  if (startDate || endDate) {
    patients = allPatients.filter((p) => {
      if (!p.first_visit_date) return false
      const visitDate = new Date(p.first_visit_date)
      if (startDate && visitDate < new Date(startDate)) return false
      if (endDate && visitDate > new Date(endDate)) return false
      return true
    })
  }

  // Mirror `.in('patient_id', patientIds)`
  const patientIds = patients.map((p) => p.id)
  const patientIdSet = new Set(patientIds)
  const treatments = convexTreatments
    .map((row) => normalizeConvexRecord(row))
    .filter((t) => patientIdSet.has(t.patient_id))

  const totalPatients = patients.length
  const newPatients = patients.filter((p) => {
    if (!startDate || !p.first_visit_date) return false
    return new Date(p.first_visit_date) >= new Date(startDate)
  }).length

  const patientsBySource = patients.reduce(
    (acc, patient) => {
      const source = patient.source_id || 'Unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const treatmentsPerPatient = treatments.reduce(
    (acc, treatment) => {
      const patientId = treatment.patient_id
      acc[patientId] = (acc[patientId] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const avgTreatmentsPerPatient =
    totalPatients > 0
      ? Object.values(treatmentsPerPatient).reduce((sum, count) => sum + count, 0) / totalPatients
      : 0

  return {
    total_patients: totalPatients,
    new_patients: newPatients,
    avg_treatments_per_patient: Math.round(avgTreatmentsPerPatient * 10) / 10,
    patients_by_source: patientsBySource,
    period: {
      start: startDate || null,
      end: endDate || null,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinic_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify clinic membership (guards BOTH the Convex and Supabase branches)
    if (!(await verifyClinicAccess(user.id, clinicId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (shouldReturnConvexData('patients')) {
      const data = await getPatientStatsFromConvex(clinicId, startDate, endDate)
      return NextResponse.json(data)
    }

    // Get all patients
    const { data: allPatients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_visit_date, source_id')
      .eq('clinic_id', clinicId)

    if (patientsError) {
      throw patientsError
    }

    // Filter by date if provided
    let patients = allPatients
    if (startDate || endDate) {
      patients = allPatients?.filter((p: ImportedRecord) => {
        if (!p.first_visit_date) return false
        const visitDate = new Date(p.first_visit_date)
        if (startDate && visitDate < new Date(startDate)) return false
        if (endDate && visitDate > new Date(endDate)) return false
        return true
      })
    }

    // Get treatments for these patients
    const patientIds = patients?.map((p: ImportedRecord) => p.id) || []
    const { data: treatments, error: treatmentsError } = await supabase
      .from('treatments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .in('patient_id', patientIds)

    if (treatmentsError) {
      throw treatmentsError
    }

    // Calculate stats
    const totalPatients = patients?.length || 0
    const newPatients = patients?.filter((p: ImportedRecord) => {
      if (!startDate || !p.first_visit_date) return false
      return new Date(p.first_visit_date) >= new Date(startDate)
    }).length || 0

    // Patients by source
    const patientsBySource = patients?.reduce(
      (acc: Record<string, number>, patient: ImportedRecord) => {
        const source = patient.source_id || 'Unknown'
        acc[source] = (acc[source] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Treatments per patient
    const treatmentsPerPatient = treatments?.reduce(
      (acc: Record<string, number>, treatment: ImportedRecord) => {
        const patientId = treatment.patient_id
        acc[patientId] = (acc[patientId] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const avgTreatmentsPerPatient =
      totalPatients > 0
        ? Object.values<number>(treatmentsPerPatient || {}).reduce((sum, count) => sum + count, 0) /
          totalPatients
        : 0

    return NextResponse.json({
      total_patients: totalPatients,
      new_patients: newPatients,
      avg_treatments_per_patient: Math.round(avgTreatmentsPerPatient * 10) / 10,
      patients_by_source: patientsBySource,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
    })
  } catch (error) {
    console.error('[API /analytics/patients/stats] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch patient stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
