import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { formatDateToISO, parseLocalDate } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

type AppointmentTrend = 'up' | 'down' | 'stable'

function startOfWeekMonday(date: Date) {
  const start = new Date(date)
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + mondayOffset)
  start.setHours(0, 0, 0, 0)
  return start
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function resolveAsOfDate(input: string | null) {
  if (!input) return new Date()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date()
  const parsed = parseLocalDate(input)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function countByDate(rows: Array<{ appointment_date: string | null }>, targetDate: string) {
  return rows.filter((row) => row.appointment_date === targetDate).length
}

function trendFromCounts(current: number, previous: number): { trend: AppointmentTrend; trendValue: number } {
  if (previous <= 0 && current <= 0) return { trend: 'stable', trendValue: 0 }
  if (previous <= 0) return { trend: 'up', trendValue: 100 }

  const delta = current - previous
  if (delta === 0) return { trend: 'stable', trendValue: 0 }

  return {
    trend: delta > 0 ? 'up' : 'down',
    trendValue: Math.round((Math.abs(delta) / previous) * 100),
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.view')
    if (forbidden) return forbidden

    const asOf = resolveAsOfDate(searchParams.get('asOf'))
    asOf.setHours(0, 0, 0, 0)

    const todayDate = formatDateToISO(asOf)
    const tomorrowDate = formatDateToISO(addDays(asOf, 1))
    const weekStartDate = formatDateToISO(startOfWeekMonday(asOf))
    const weekEndDate = formatDateToISO(addDays(startOfWeekMonday(asOf), 6))
    const previousWeekStartDate = formatDateToISO(addDays(startOfWeekMonday(asOf), -7))
    const previousWeekEndDate = formatDateToISO(addDays(startOfWeekMonday(asOf), -1))

    const { data: treatments, error: treatmentsError } = await supabaseAdmin
      .from('treatments')
      .select('id, treatment_date')
      .eq('clinic_id', clinicId)
      .gte('treatment_date', previousWeekStartDate)
      .lte('treatment_date', weekEndDate)
      .in('status', ['pending', 'scheduled', 'in_progress'])
      .not('treatment_date', 'is', null)

    if (treatmentsError) throw treatmentsError

    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('public_bookings')
      .select('id, requested_date')
      .eq('clinic_id', clinicId)
      .gte('requested_date', previousWeekStartDate)
      .lte('requested_date', weekEndDate)
      .in('status', ['pending', 'confirmed'])
      .is('treatment_id', null)

    if (bookingsError) throw bookingsError

    const appointments = [
      ...(treatments || []).map((row) => ({ appointment_date: row.treatment_date as string | null })),
      ...(bookings || []).map((row) => ({ appointment_date: row.requested_date as string | null })),
    ]

    const thisWeekAppointments = appointments.filter((row) => {
      return Boolean(row.appointment_date) &&
        row.appointment_date! >= weekStartDate &&
        row.appointment_date! <= weekEndDate
    }).length
    const previousWeekAppointments = appointments.filter((row) => {
      return Boolean(row.appointment_date) &&
        row.appointment_date! >= previousWeekStartDate &&
        row.appointment_date! <= previousWeekEndDate
    }).length
    const trend = trendFromCounts(thisWeekAppointments, previousWeekAppointments)

    return NextResponse.json({
      today: countByDate(appointments, todayDate),
      tomorrow: countByDate(appointments, tomorrowDate),
      thisWeek: thisWeekAppointments,
      trend: trend.trend,
      trendValue: trend.trendValue
    })
  } catch (error) {
    console.error('Dashboard appointments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments data' },
      { status: 500 }
    )
  }
}
