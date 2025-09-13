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

    const { data, error } = await supabaseAdmin
      .from('treatments')
      .select('status, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (error) throw error

    const nonCancelled = (data || []).filter(t => t.status !== 'cancelled')
    const completed = nonCancelled.filter(t => t.status === 'completed')
    const pending = nonCancelled.filter(t => t.status === 'pending')

    return NextResponse.json({ treatments: { total: nonCancelled.length, completed: completed.length, pending: pending.length } })
  } catch (err) {
    console.error('dashboard/treatments error', err)
    return NextResponse.json({ error: 'Failed to fetch treatments metrics' }, { status: 500 })
  }
}

