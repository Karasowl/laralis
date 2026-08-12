import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { listConvexDocumentsByClinic } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { getPreviousPeriodRange } from '@/lib/calc/metrics'
import { formatDateToISO, parseLocalDate } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'


type SupportedPeriod = 'today' | 'day' | 'week' | 'month' | 'year' | 'custom'

const normalisePeriod = (input: string | null): SupportedPeriod => {
  if (!input) return 'month'
  if (input === 'today') return 'today'
  if (input === 'day') return 'day'
  if (input === 'week') return 'week'
  if (input === 'year') return 'year'
  if (input === 'custom') return 'custom'
  return 'month'
}

interface RangeResult {
  current: { start: Date; end: Date }
  previous: { start: Date; end: Date }
  label: SupportedPeriod
}

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

const toDateParam = formatDateToISO

function computeRanges(period: SupportedPeriod, from?: string | null, to?: string | null): RangeResult {
  const now = new Date()

  if (period === 'custom' && from && to) {
    const start = startOfDay(parseLocalDate(from))
    const end = endOfDay(parseLocalDate(to))
    const previousRange = getPreviousPeriodRange(from, to)
    return {
      current: { start, end },
      previous: {
        start: startOfDay(parseLocalDate(previousRange.from)),
        end: endOfDay(parseLocalDate(previousRange.to)),
      },
      label: 'custom',
    }
  }

  const result: RangeResult = {
    current: { start: startOfDay(now), end: endOfDay(now) },
    previous: { start: startOfDay(now), end: endOfDay(now) },
    label: period === 'day' ? 'today' : period,
  }

  switch (period) {
    case 'today':
    case 'day': {
      const currentStart = startOfDay(now)
      result.current.start = currentStart
      result.current.end = endOfDay(now)
      const prevEnd = new Date(currentStart.getTime() - 1)
      result.previous.end = endOfDay(prevEnd)
      result.previous.start = startOfDay(prevEnd)
      break
    }
    case 'week': {
      const currentStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
      const currentEnd = endOfDay(now)
      result.current.start = currentStart
      result.current.end = currentEnd
      const prevEnd = new Date(currentStart.getTime() - 1)
      result.previous.end = endOfDay(prevEnd)
      result.previous.start = startOfDay(new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - 6))
      break
    }
    case 'year': {
      result.current.start = startOfDay(new Date(now.getFullYear(), 0, 1))
      result.current.end = endOfDay(now)
      result.previous.start = startOfDay(new Date(now.getFullYear() - 1, 0, 1))
      result.previous.end = endOfDay(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))
      break
    }
    case 'month':
    default: {
      result.current.start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
      result.current.end = endOfDay(now)
      const prevMonthStart = now.getMonth() === 0
        ? new Date(now.getFullYear() - 1, 11, 1)
        : new Date(now.getFullYear(), now.getMonth() - 1, 1)
      result.previous.start = startOfDay(prevMonthStart)
      result.previous.end = endOfDay(new Date(result.previous.start.getFullYear(), result.previous.start.getMonth() + 1, 0))
      break
    }
  }

  return result
}

const sumExpenses = (rows: Array<{ amount_cents?: number | null }>) =>
  rows.reduce((acc, row) => acc + (row.amount_cents ?? 0), 0)

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'financial_reports.view')
    if (forbidden) return forbidden

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })
    }

    const rawPeriod = normalisePeriod(searchParams.get('period'))
    // Support both naming conventions: date_from/date_to and startDate/endDate
    const dateFrom = searchParams.get('date_from') || searchParams.get('startDate')
    const dateTo = searchParams.get('date_to') || searchParams.get('endDate')
    // If explicit dates are provided, use them as custom range (overrides period)
    const period: SupportedPeriod = (dateFrom && dateTo) ? 'custom' : rawPeriod
    const ranges = computeRanges(period, dateFrom, dateTo)

    if (shouldReturnConvexData('dashboard')) {
      const expenses = await listConvexDocumentsByClinic('expenses', clinicId)
      const currentStart = toDateParam(ranges.current.start)
      const currentEnd = toDateParam(ranges.current.end)
      const previousStart = toDateParam(ranges.previous.start)
      const previousEnd = toDateParam(ranges.previous.end)

      const currentExpenses = expenses.filter((row: any) => {
        const expenseDate = String(row.expense_date || '')
        return expenseDate >= currentStart && expenseDate <= currentEnd
      })
      const previousExpenses = expenses.filter((row: any) => {
        const expenseDate = String(row.expense_date || '')
        return expenseDate >= previousStart && expenseDate <= previousEnd
      })

      return NextResponse.json({
        expenses: {
          current: sumExpenses(currentExpenses),
          previous: sumExpenses(previousExpenses),
        },
        totals: {
          current_count: currentExpenses.length,
          previous_count: previousExpenses.length,
        },
        period: ranges.label,
      })
    }

    const { data: currentExpenses, error: currentErr } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, expense_date')
      .eq('clinic_id', clinicId)
      .gte('expense_date', toDateParam(ranges.current.start))
      .lte('expense_date', toDateParam(ranges.current.end))

    if (currentErr) throw currentErr

    const { data: previousExpenses, error: previousErr } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, expense_date')
      .eq('clinic_id', clinicId)
      .gte('expense_date', toDateParam(ranges.previous.start))
      .lte('expense_date', toDateParam(ranges.previous.end))

    if (previousErr) throw previousErr

    const currentTotal = sumExpenses(currentExpenses || [])
    const previousTotal = sumExpenses(previousExpenses || [])

    return NextResponse.json({
      expenses: {
        current: currentTotal,
        previous: previousTotal,
      },
      totals: {
        current_count: currentExpenses?.length ?? 0,
        previous_count: previousExpenses?.length ?? 0,
      },
      period: ranges.label,
    })
  } catch (error) {
    console.error('Dashboard expenses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses data' },
      { status: 500 }
    )
  }
}
