import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const clinicId = sp.get('clinicId')
    const period = sp.get('period') || 'month'
    const dateFrom = sp.get('date_from')
    const dateTo = sp.get('date_to')

    if (!clinicId) return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })

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

