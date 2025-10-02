import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'

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

    // Fetch completed treatments within period
    const { data: treatments, error: tErr } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, created_at, status, service_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (tErr) throw tErr

    // Fetch service categories
    const serviceIds = Array.from(new Set((treatments || []).map(t => t.service_id).filter(Boolean)))
    let categoriesMap: Record<string, string> = {}
    if (serviceIds.length > 0) {
      const { data: services, error: sErr } = await supabaseAdmin
        .from('services')
        .select('id, category')
        .in('id', serviceIds)
      if (sErr) throw sErr
      categoriesMap = Object.fromEntries((services || []).map(s => [s.id, s.category || 'Otros']))
    }

    const sums: Record<string, number> = {}
    for (const t of treatments || []) {
      const cat = categoriesMap[t.service_id as string] || 'Otros'
      sums[cat] = (sums[cat] || 0) + Math.round((t.price_cents || 0) / 100)
    }

    const categories = Object.entries(sums).map(([name, value]) => ({ name, value }))
    return NextResponse.json({ categories })
  } catch (err) {
    console.error('charts/categories error', err)
    return NextResponse.json({ error: 'Failed to compute category chart' }, { status: 500 })
  }
}
