import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'

const querySchema = z.object({
  clinicId: z.string().optional(),
  period: z.enum(['month', 'quarter', 'year']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfQuarter(date: Date) {
  const quarter = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), quarter * 3, 1)
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1)
}

function formatISO(date: Date) {
  return date.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(searchParams)

    if (!parsed.success) {
      const message = parsed.error.errors.map(err => err.message).join(', ')
      return NextResponse.json({ error: 'Invalid query parameters', message }, { status: 400 })
    }

    const { clinicId: requestedClinicId, period = 'month', from, to } = parsed.data

    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({ requestedClinicId, cookieStore })

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const clinicId = clinicContext.clinicId
    const now = new Date()

    let rangeStart: Date
    let rangeEnd: Date

    if (from && to) {
      rangeStart = new Date(from)
      rangeEnd = new Date(to)
    } else {
      switch (period) {
        case 'quarter':
          rangeStart = startOfQuarter(now)
          break
        case 'year':
          rangeStart = startOfYear(now)
          break
        case 'month':
        default:
          rangeStart = startOfMonth(now)
          break
      }
      rangeEnd = now
    }

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const startISO = formatISO(rangeStart)
    const endISO = formatISO(rangeEnd)

    const { data: treatments, error } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, treatment_date, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', startISO)
      .lte('treatment_date', endISO)

    if (error) {
      console.error('[reports/revenue] Failed to fetch treatments', error)
      return NextResponse.json({ error: 'Failed to fetch treatments', message: error.message }, { status: 500 })
    }

    const completed = Array.isArray(treatments) ? treatments : []

    const totalCents = completed.reduce((sum, row: any) => sum + Number(row.price_cents || 0), 0)
    const count = completed.length

    const millisecondsPerDay = 24 * 60 * 60 * 1000
    const days = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime() + millisecondsPerDay) / millisecondsPerDay))
    const averageDailyCents = Math.round(totalCents / days)

    return NextResponse.json({
      data: {
        clinicId,
        period,
        range: { from: startISO, to: endISO },
        total_cents: totalCents,
        completed_count: count,
        average_daily_cents: averageDailyCents,
        days,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/reports/revenue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
