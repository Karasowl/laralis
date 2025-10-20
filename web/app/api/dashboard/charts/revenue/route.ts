import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { startOfWeek, format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function weekKey(d: Date) {
  const weekStart = startOfWeek(d, { weekStartsOn: 1 }) // Monday
  return format(weekStart, 'yyyy-MM-dd')
}

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function biweekKey(d: Date) {
  const day = d.getDate()
  const period = day <= 15 ? '01-15' : '16-31'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${period}`
}

function monthLabelEs(monthIndex: number) {
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return labels[monthIndex]
}

function formatLabel(key: string, granularity: string): string {
  if (granularity === 'day') {
    const date = new Date(key)
    return format(date, 'd MMM', { locale: es })
  } else if (granularity === 'week') {
    const date = new Date(key)
    const endDate = addDays(date, 6)
    return `${format(date, 'd MMM', { locale: es })}`
  } else if (granularity === 'biweek') {
    const [year, month, period] = key.split('-')
    const monthName = monthLabelEs(parseInt(month) - 1)
    return period === '01' ? `${monthName} 1-15` : `${monthName} 16-31`
  } else {
    // month
    const [y, m] = key.split('-').map(Number)
    return monthLabelEs(m - 1)
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const clinicId = sp.get('clinicId')
    const period = sp.get('period') || 'month'
    const granularity = sp.get('granularity') || 'month' // day, week, biweek, month
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
    } else if (granularity === 'day') {
      // Last 30 days for daily view
      start = new Date(now)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      end = new Date(now)
    } else if (granularity === 'week') {
      // Last 12 weeks
      start = new Date(now)
      start.setDate(start.getDate() - (12 * 7))
      start.setHours(0, 0, 0, 0)
      end = new Date(now)
    } else if (granularity === 'biweek') {
      // Last 6 biweeks (3 months)
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      end = new Date(now)
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

    // Build periods map based on granularity
    const getKeyForDate = (d: Date): string => {
      if (granularity === 'day') return dayKey(d)
      if (granularity === 'week') return weekKey(d)
      if (granularity === 'biweek') return biweekKey(d)
      return monthKey(d)
    }

    const periods: string[] = []
    const cursor = new Date(start)

    // Generate all periods in range
    if (granularity === 'day') {
      while (cursor <= end) {
        periods.push(dayKey(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
    } else if (granularity === 'week') {
      const weekStart = startOfWeek(cursor, { weekStartsOn: 1 })
      cursor.setTime(weekStart.getTime())
      while (cursor <= end) {
        periods.push(weekKey(cursor))
        cursor.setDate(cursor.getDate() + 7)
      }
    } else if (granularity === 'biweek') {
      // Generate biweekly periods
      cursor.setDate(1) // Start at beginning of month
      while (cursor <= end) {
        periods.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01-15`)
        periods.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-16-31`)
        cursor.setMonth(cursor.getMonth() + 1)
      }
    } else {
      // Monthly
      cursor.setDate(1)
      while (cursor <= end) {
        periods.push(monthKey(cursor))
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }

    const revenueByPeriod: Record<string, number> = Object.fromEntries(periods.map(k => [k, 0]))
    const expensesByPeriod: Record<string, number> = Object.fromEntries(periods.map(k => [k, 0]))

    for (const t of treatments || []) {
      if (!t.treatment_date) continue
      const d = new Date(t.treatment_date as string)
      if (Number.isNaN(d.getTime())) continue
      const k = getKeyForDate(d)
      if (k in revenueByPeriod) revenueByPeriod[k] += (t.price_cents || 0)
    }

    for (const ex of expenses || []) {
      const d = new Date(ex.expense_date as string)
      const k = getKeyForDate(d)
      if (k in expensesByPeriod) expensesByPeriod[k] += (ex.amount_cents || 0)
    }

    const result = periods.map(k => {
      return {
        month: formatLabel(k, granularity),
        revenue: revenueByPeriod[k] || 0,
        expenses: expensesByPeriod[k] || 0,
      }
    })

    return NextResponse.json({ revenue: result })
  } catch (err: any) {
    console.error('charts/revenue error', err)
    return NextResponse.json({ error: 'Failed to compute revenue chart' }, { status: 500 })
  }
}
