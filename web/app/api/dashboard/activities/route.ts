import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'

export const dynamic = 'force-dynamic'


interface Activity {
  id: string;
  type: 'treatment' | 'patient' | 'expense';
  title: string;
  description: string;
  amount?: number | null;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cookieStore = cookies()
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId } = ctx
    const limit = parseInt(searchParams.get('limit') || '10')
    
    

    // Fetch recent activities from different tables
    const activities: Activity[] = []
    
    // Get recent treatments
    const { data: treatments } = await supabaseAdmin
      .from('treatments')
      .select('id, created_at, patient_id, service_id, status, price_cents')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(5)
    const serviceIds = Array.from(new Set((treatments || []).map((t: any) => t.service_id).filter(Boolean)))
    const patientIds = Array.from(new Set((treatments || []).map((t: any) => t.patient_id).filter(Boolean)))
    let servicesMap: Record<string, string> = {}
    let patientsMap: Record<string, string> = {}
    if (serviceIds.length) {
      const { data: services } = await supabaseAdmin
        .from('services')
        .select('id, name')
        .in('id', serviceIds)
      servicesMap = Object.fromEntries((services || []).map((s: any) => [s.id, s.name]))
    }
    if (patientIds.length) {
      const { data: patients } = await supabaseAdmin
        .from('patients')
        .select('id, first_name, last_name')
        .in('id', patientIds)
      patientsMap = Object.fromEntries((patients || []).map((p: any) => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]))
    }
    ;(treatments || []).forEach((t: any) => {
      const service = servicesMap[t.service_id] || 'Servicio'
      const patient = patientsMap[t.patient_id] || 'Paciente'
      const title = t.status === 'completed' ? 'Tratamiento completado' : 'Tratamiento registrado'
      activities.push({
        id: `treatment-${t.id}`,
        type: 'treatment',
        title,
        description: `${service} - ${patient}`,
        amount: t.price_cents,
        timestamp: t.created_at,
      })
    })

    // Get recent patients
    const { data: patients } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(3)

    patients?.forEach((patient: any) => {
      activities.push({
        id: `patient-${patient.id}`,
        type: 'patient',
        title: 'Nuevo paciente',
        description: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        timestamp: patient.created_at,
      })
    })

    // Get recent expenses
    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('id, description, amount_cents, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(3)

    expenses?.forEach((expense: any) => {
      activities.push({
        id: `expense-${expense.id}`,
        type: 'expense',
        title: 'Gasto registrado',
        description: expense.description,
        amount: expense.amount_cents,
        timestamp: expense.created_at,
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

