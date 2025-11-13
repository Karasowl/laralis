/**
 * Analytics: Patient Stats
 *
 * GET /api/analytics/patients/stats
 * Returns patient metrics and statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
      patients = allPatients?.filter((p) => {
        if (!p.first_visit_date) return false
        const visitDate = new Date(p.first_visit_date)
        if (startDate && visitDate < new Date(startDate)) return false
        if (endDate && visitDate > new Date(endDate)) return false
        return true
      })
    }

    // Get treatments for these patients
    const patientIds = patients?.map((p) => p.id) || []
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
    const newPatients = patients?.filter((p) => {
      if (!startDate || !p.first_visit_date) return false
      return new Date(p.first_visit_date) >= new Date(startDate)
    }).length || 0

    // Patients by source
    const patientsBySource = patients?.reduce(
      (acc, patient) => {
        const source = patient.source_id || 'Unknown'
        acc[source] = (acc[source] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Treatments per patient
    const treatmentsPerPatient = treatments?.reduce(
      (acc, treatment) => {
        const patientId = treatment.patient_id
        acc[patientId] = (acc[patientId] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const avgTreatmentsPerPatient =
      totalPatients > 0
        ? Object.values(treatmentsPerPatient || {}).reduce((sum, count) => sum + count, 0) /
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
