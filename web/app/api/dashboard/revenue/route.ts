import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type SupportedPeriod = 'today' | 'day' | 'week' | 'month' | 'year' | 'custom'

function normalisePeriod(input: string | null): SupportedPeriod {
  if (!input) return 'month'
  if (input === 'today') return 'today'
  if (input === 'day') return 'day'
  if (input === 'week') return 'week'
  if (input === 'year') return 'year'
  if (input === 'custom') return 'custom'
  return 'month'
}

interface DateRangeResult {
  current: { start: Date; end: Date }
  previous: { start: Date; end: Date }
  label: SupportedPeriod
}

function computeRanges(period: SupportedPeriod, from?: string | null, to?: string | null): DateRangeResult {
  const now = new Date()

  const startOfDay = (date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const endOfDay = (date: Date) => {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
  }

  const clone = (date: Date) => new Date(date.getTime())

  if (period === 'custom' && from && to) {
    const start = startOfDay(new Date(from))
    const end = endOfDay(new Date(to))
    const durationMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000)
    const previousEnd = new Date(start.getTime() - 1)
    const previousStart = new Date(previousEnd.getTime() - durationMs)
    return {
      current: { start, end },
      previous: { start: startOfDay(previousStart), end: endOfDay(previousEnd) },
      label: 'custom'
    }
  }

  const current: { start: Date; end: Date } = { start: startOfDay(now), end: endOfDay(now) }
  const previous: { start: Date; end: Date } = { start: startOfDay(now), end: endOfDay(now) }

  switch (period) {
    case 'today':
    case 'day': {
      current.start = startOfDay(now)
      current.end = endOfDay(now)
      previous.end = new Date(current.start.getTime() - 1)
      previous.start = startOfDay(previous.end)
      break
    }
    case 'week': {
      const currentEnd = endOfDay(now)
      const currentStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
      current.start = currentStart
      current.end = currentEnd
      const prevEnd = startOfDay(new Date(currentStart.getTime() - 1))
      const prevStart = startOfDay(new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - 6))
      previous.start = prevStart
      previous.end = endOfDay(prevEnd)
      break
    }
    case 'year': {
      current.start = startOfDay(new Date(now.getFullYear(), 0, 1))
      current.end = endOfDay(now)
      previous.start = startOfDay(new Date(now.getFullYear() - 1, 0, 1))
      previous.end = endOfDay(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))
      break
    }
    case 'month':
    default: {
      current.start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      current.end = endOfDay(now)
      const prevMonth = now.getMonth() === 0
        ? new Date(now.getFullYear() - 1, 11, 1)
        : new Date(now.getFullYear(), now.getMonth() - 1, 1)
      previous.start = startOfDay(clone(prevMonth))
      previous.end = endOfDay(new Date(previous.start.getFullYear(), previous.start.getMonth() + 1, 0))
      break
    }
  }

  return { current, previous, label: period === 'day' ? 'today' : period }
}

const toDateParam = (date: Date) => date.toISOString().split('T')[0]

const sumRevenue = (rows: Array<{ price_cents?: number | null; final_price_cents?: number | null }>) =>
  rows.reduce((acc, row) => acc + (row.price_cents ?? row.final_price_cents ?? 0), 0)

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }

    const { clinicId } = ctx
    const period = normalisePeriod(searchParams.get('period'))
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const ranges = computeRanges(period, dateFrom, dateTo)

    const { data: currentTreatments, error: currentErr } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, final_price_cents, status, treatment_date')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', toDateParam(ranges.current.start))
      .lte('treatment_date', toDateParam(ranges.current.end))

    if (currentErr) throw currentErr

    const { data: previousTreatments, error: previousErr } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, final_price_cents, status, treatment_date')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', toDateParam(ranges.previous.start))
      .lte('treatment_date', toDateParam(ranges.previous.end))

    if (previousErr) throw previousErr

    const currentTotal = sumRevenue(currentTreatments || [])
    const previousTotal = sumRevenue(previousTreatments || [])

    return NextResponse.json({
      revenue: {
        current: currentTotal,
        previous: previousTotal,
      },
      totals: {
        current_count: currentTreatments?.length ?? 0,
        previous_count: previousTreatments?.length ?? 0,
      },
      period: ranges.label,
    })
  } catch (error) {
    console.error('Dashboard revenue error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    )
  }
}
