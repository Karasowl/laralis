import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { checkConflicts, Appointment } from '@/lib/calendar/conflict-detection'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const cookieStore = cookies()

    const clinicContext = await resolveClinicContext({
      requestedClinicId: body?.clinic_id,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId } = clinicContext

    // Validate required fields
    const { date, time, duration_minutes, exclude_id } = body

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Date and time are required' },
        { status: 400 }
      )
    }

    const duration = duration_minutes || 30

    // Fetch existing appointments for the same date
    const { data: treatments, error } = await supabaseAdmin
      .from('treatments')
      .select(`
        id,
        treatment_date,
        treatment_time,
        duration_minutes,
        patient:patients (first_name, last_name),
        service:services (name)
      `)
      .eq('clinic_id', clinicId)
      .eq('treatment_date', date)
      .in('status', ['pending', 'scheduled', 'in_progress'])

    if (error) {
      console.error('Error fetching treatments for conflict check:', error)
      return NextResponse.json(
        { error: 'Failed to check conflicts' },
        { status: 500 }
      )
    }

    // Transform to Appointment format
    const appointments: Appointment[] = (treatments || []).map((t: any) => ({
      id: t.id,
      treatment_date: t.treatment_date,
      treatment_time: t.treatment_time,
      duration_minutes: t.duration_minutes || 30,
      patient_name: t.patient
        ? `${t.patient.first_name} ${t.patient.last_name}`
        : undefined,
      service_name: t.service?.name,
    }))

    // Check for conflicts
    const result = checkConflicts(
      { date, time, duration_minutes: duration },
      appointments,
      exclude_id
    )

    return NextResponse.json({
      hasConflict: result.hasConflict,
      conflicts: result.conflicts,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/treatments/check-conflicts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
