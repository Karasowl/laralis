import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { listConvexDocumentsByClinic } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { collectedRevenueCents } from '@/lib/calc/metrics'
import { formatDateToISO, parseLocalDate } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const sp = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: sp.get('clinicId'), cookieStore })
    if ('error' in ctx) return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'financial_reports.view')
    if (forbidden) return forbidden

    const period = sp.get('period') || 'month'
    const dateFrom = sp.get('date_from')
    const dateTo = sp.get('date_to')

    

    const now = new Date()
    let start: Date
    let end: Date
    if (dateFrom && dateTo) {
      start = parseLocalDate(dateFrom)
      end = parseLocalDate(dateTo)
      end.setHours(23, 59, 59, 999)
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now)
    }

    const startISO = formatDateToISO(start)
    const endISO = formatDateToISO(end)

    if (shouldReturnConvexData('dashboard')) {
      const [allTreatments, services] = await Promise.all([
        listConvexDocumentsByClinic('treatments', clinicId),
        listConvexDocumentsByClinic('services', clinicId),
      ])
      const serviceInfo = new Map<string, { name: string; category?: string }>()
      for (const service of services as any[]) {
        serviceInfo.set(service.id, {
          name: service.name || 'Servicio sin nombre',
          category: service.category || undefined,
        })
      }

      const sums: Record<string, number> = {}
      for (const t of allTreatments as any[]) {
        const treatmentDate = String(t.treatment_date || '')
        if (t.status !== 'completed' || treatmentDate < startISO || treatmentDate > endISO) continue
        if (!t.service_id) continue
        const info = serviceInfo.get(t.service_id)
        const label = info?.name || info?.category || 'Servicio sin nombre'
        sums[label] = (sums[label] || 0) + collectedRevenueCents(t)
      }

      return NextResponse.json({
        categories: Object.entries(sums).map(([name, value]) => ({ name, value }))
      })
    }

    // Fetch completed treatments within period
    const { data: treatments, error: tErr } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, amount_paid_cents, is_paid, treatment_date, status, service_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', startISO)
      .lte('treatment_date', endISO)

    if (tErr) throw tErr

    // Fetch service categories
    const serviceIds = Array.from(new Set((treatments || []).map(t => t.service_id).filter(Boolean)))
    const serviceInfo = new Map<string, { name: string; category?: string }>()
    if (serviceIds.length > 0) {
      const { data: services, error: sErr } = await supabaseAdmin
        .from('services')
        .select('id, name, category')
        .in('id', serviceIds)
      if (sErr) throw sErr
      for (const service of services || []) {
        serviceInfo.set(service.id, {
          name: service.name || 'Servicio sin nombre',
          category: service.category || undefined
        })
      }
    }

    const sums: Record<string, number> = {}
    for (const t of treatments || []) {
      if (!t.service_id) continue
      if (!t.treatment_date || Number.isNaN(new Date(t.treatment_date as string).getTime())) continue
      const info = serviceInfo.get(t.service_id)
      const label = info?.name || info?.category || 'Servicio sin nombre'
      sums[label] = (sums[label] || 0) + collectedRevenueCents(t)
    }

    const categories = Object.entries(sums).map(([name, value]) => ({ name, value }))
    return NextResponse.json({ categories })
  } catch (err) {
    console.error('charts/categories error', err)
    return NextResponse.json({ error: 'Failed to compute category chart' }, { status: 500 })
  }
}
