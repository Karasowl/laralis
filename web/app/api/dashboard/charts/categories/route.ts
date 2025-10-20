import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const sp = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: sp.get('clinicId'), cookieStore })
    if ('error' in ctx) return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    const { clinicId } = ctx
    const period = sp.get('period') || 'month'
    const dateFrom = sp.get('date_from')
    const dateTo = sp.get('date_to')

    

    const now = new Date()
    let start: Date
    let end: Date
    if (period === 'custom' && dateFrom && dateTo) {
      start = new Date(dateFrom)
      end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now)
    }

    const startISO = start.toISOString().split('T')[0]
    const endISO = end.toISOString().split('T')[0]

    // Fetch completed treatments within period
    const { data: treatments, error: tErr } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, treatment_date, status, service_id')
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
      sums[label] = (sums[label] || 0) + (t.price_cents || 0)
    }

    const categories = Object.entries(sums).map(([name, value]) => ({ name, value }))
    return NextResponse.json({ categories })
  } catch (err) {
    console.error('charts/categories error', err)
    return NextResponse.json({ error: 'Failed to compute category chart' }, { status: 500 })
  }
}
