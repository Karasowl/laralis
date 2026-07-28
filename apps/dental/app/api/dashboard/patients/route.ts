import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { listConvexDocumentsByClinic } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const sp = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: sp.get('clinicId'), cookieStore })
    if ('error' in ctx) return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'patients.view')
    if (forbidden) return forbidden

    const rawPeriod = sp.get('period') || 'month'
    // Support both naming conventions: date_from/date_to and startDate/endDate
    const dateFrom = sp.get('date_from') || sp.get('startDate')
    const dateTo = sp.get('date_to') || sp.get('endDate')
    // If explicit dates are provided, use them as custom range (overrides period)
    const period = (dateFrom && dateTo) ? 'custom' : rawPeriod

    const now = new Date()
    let start: Date
    let end: Date
    if (dateFrom && dateTo) {
      // Use explicit dates when provided (regardless of period)
      start = new Date(dateFrom)
      end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now)
    }

    if (shouldReturnConvexData('dashboard')) {
      const patients = await listConvexDocumentsByClinic('patients', clinicId)
      const treatments = await listConvexDocumentsByClinic('treatments', clinicId)

      const newly = patients.filter((patient: any) => {
        const createdAt = typeof patient.created_at === 'string' ? patient.created_at : ''
        return createdAt >= start.toISOString() && createdAt <= end.toISOString()
      }).length

      const startDate = start.toISOString().split('T')[0]
      const endDate = end.toISOString().split('T')[0]
      const activeStart = new Date()
      activeStart.setDate(activeStart.getDate() - 90)
      const activeStartDate = activeStart.toISOString().split('T')[0]

      const attendedCount = new Set(
        treatments
          .filter((treatment: any) => {
            const treatmentDate = String(treatment.treatment_date || '')
            return treatmentDate >= startDate && treatmentDate <= endDate
          })
          .map((treatment: any) => treatment.patient_id)
          .filter(Boolean)
      ).size

      const activeCount = new Set(
        treatments
          .filter((treatment: any) => String(treatment.treatment_date || '') >= activeStartDate)
          .map((treatment: any) => treatment.patient_id)
          .filter(Boolean)
      ).size

      return NextResponse.json({
        patients: {
          total: patients.length,
          new: newly,
          attended: attendedCount,
          active: activeCount,
        }
      })
    }

    const { count: total, error: totalErr } = await supabaseAdmin
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
    if (totalErr) throw totalErr

    const { count: newly, error: newErr } = await supabaseAdmin
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    if (newErr) throw newErr

    // Pacientes ATENDIDOS en el periodo (con tratamiento) - ISSUE-004
    const { data: treatedPatients, error: treatedErr } = await supabaseAdmin
      .from('treatments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', start.toISOString().split('T')[0])
      .lte('treatment_date', end.toISOString().split('T')[0])
    if (treatedErr) throw treatedErr

    // Contar pacientes únicos atendidos
    const uniquePatientIds = new Set(treatedPatients?.map(t => t.patient_id) || [])
    const attendedCount = uniquePatientIds.size

    // Pacientes activos (con tratamiento en últimos 90 días)
    const activeStart = new Date()
    activeStart.setDate(activeStart.getDate() - 90)
    const { data: activePatients, error: activeErr } = await supabaseAdmin
      .from('treatments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', activeStart.toISOString().split('T')[0])
    if (activeErr) throw activeErr

    const uniqueActiveIds = new Set(activePatients?.map(t => t.patient_id) || [])
    const activeCount = uniqueActiveIds.size

    return NextResponse.json({
      patients: {
        total: total || 0,           // Total histórico (sin cambios)
        new: newly || 0,              // Nuevos en el periodo
        attended: attendedCount,      // NUEVO: Atendidos en el periodo
        active: activeCount           // Activos (últimos 90 días)
      }
    })
  } catch (err) {
    console.error('dashboard/patients error', err)
    return NextResponse.json({ error: 'Failed to fetch patients metrics' }, { status: 500 })
  }
}
