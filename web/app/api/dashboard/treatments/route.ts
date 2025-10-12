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
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const startISO = start.toISOString().split('T')[0]
    const endISO = end.toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('treatments')
      .select('status, treatment_date')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', startISO)
      .lte('treatment_date', endISO)

    if (error) throw error

    const nonCancelled = (data || []).filter(t => t.status !== 'cancelled')
    const normalised = nonCancelled.map(t => {
      const status = t.status === 'scheduled' || t.status === 'in_progress' ? 'pending' : (t.status || 'pending')
      return { status }
    })
    const completed = normalised.filter(t => t.status === 'completed')
    const pending = normalised.filter(t => t.status === 'pending')

    return NextResponse.json({
      treatments: {
        total: normalised.length,
        completed: completed.length,
        pending: pending.length
      }
    })
  } catch (err) {
    console.error('dashboard/treatments error', err)
    return NextResponse.json({ error: 'Failed to fetch treatments metrics' }, { status: 500 })
  }
}
