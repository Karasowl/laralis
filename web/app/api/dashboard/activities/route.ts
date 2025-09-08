import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })
    }

    // Fetch recent activities from different tables
    const activities = []
    
    // Get recent treatments
    const { data: treatments } = await supabase
      .from('treatments')
      .select('id, created_at, patient_id, patients(name), services(name)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(5)

    treatments?.forEach(treatment => {
      activities.push({
        id: `treatment-${treatment.id}`,
        type: 'treatment',
        // @ts-ignore
        description: `Tratamiento realizado: ${treatment.services?.name || 'Servicio'}`,
        // @ts-ignore
        patient: treatment.patients?.name || 'Paciente',
        timestamp: treatment.created_at,
        icon: 'activity'
      })
    })

    // Get recent patients
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(3)

    patients?.forEach(patient => {
      activities.push({
        id: `patient-${patient.id}`,
        type: 'patient',
        description: 'Nuevo paciente registrado',
        patient: patient.name,
        timestamp: patient.created_at,
        icon: 'user-plus'
      })
    })

    // Get recent expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, description, amount_cents, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(3)

    expenses?.forEach(expense => {
      activities.push({
        id: `expense-${expense.id}`,
        type: 'expense',
        description: `Gasto registrado: ${expense.description}`,
        amount: expense.amount_cents,
        timestamp: expense.created_at,
        icon: 'receipt'
      })
    })

    // Sort all activities by timestamp
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Return limited number of activities
    return NextResponse.json(activities.slice(0, limit))
  } catch (error) {
    console.error('Dashboard activities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}