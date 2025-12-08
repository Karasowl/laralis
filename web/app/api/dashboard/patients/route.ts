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

    return NextResponse.json({ patients: { total: total || 0, new: newly || 0 } })
  } catch (err) {
    console.error('dashboard/patients error', err)
    return NextResponse.json({ error: 'Failed to fetch patients metrics' }, { status: 500 })
  }
}
