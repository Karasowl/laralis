import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelEs(monthIndex: number) {
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return labels[monthIndex]
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const clinicId = sp.get('clinicId')
    const period = sp.get('period') || 'month'
    const dateFrom = sp.get('date_from')
    const dateTo = sp.get('date_to')

    if (!clinicId) return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })

    // Range: last 6 months or custom period
    const now = new Date()
    let start: Date
    let end: Date
    if (period === 'custom' && dateFrom && dateTo) {
      start = new Date(dateFrom)
      end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
    } else {
      // Last 6 months including current
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      end = new Date(now)
    }

    // Fetch completed treatments (revenue)
    const startISO = start.toISOString().split('T')[0]
    const endISO = end.toISOString().split('T')[0]

    const { data: treatments, error: tErr } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, treatment_date, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', startISO)
      .lte('treatment_date', endISO)

    if (tErr) throw tErr

    // Fetch expenses in range
    const { data: expenses, error: eErr } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, expense_date')
      .eq('clinic_id', clinicId)
      .gte('expense_date', start.toISOString().split('T')[0])
      .lte('expense_date', end.toISOString().split('T')[0])

    if (eErr) throw eErr

    // Build months map
    const months: string[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      months.push(monthKey(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }
    const revenueByMonth: Record<string, number> = Object.fromEntries(months.map(k => [k, 0]))
    const expensesByMonth: Record<string, number> = Object.fromEntries(months.map(k => [k, 0]))

    for (const t of treatments || []) {
      if (!t.treatment_date) continue
      const d = new Date(t.treatment_date as string)
      if (Number.isNaN(d.getTime())) continue
      const k = monthKey(d)
      if (k in revenueByMonth) revenueByMonth[k] += Math.round((t.price_cents || 0) / 100)
    }

    for (const ex of expenses || []) {
      const d = new Date(ex.expense_date as string)
      const k = monthKey(d)
      if (k in expensesByMonth) expensesByMonth[k] += Math.round((ex.amount_cents || 0) / 100)
    }

    const result = months.map(k => {
      const [y, m] = k.split('-').map(Number)
      return {
        month: monthLabelEs(m - 1),
        revenue: revenueByMonth[k] || 0,
        expenses: expensesByMonth[k] || 0,
      }
    })

    return NextResponse.json({ revenue: result })
  } catch (err: any) {
    console.error('charts/revenue error', err)
    return NextResponse.json({ error: 'Failed to compute revenue chart' }, { status: 500 })
  }
}
