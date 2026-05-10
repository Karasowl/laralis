import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const statusSchema = z.enum(['pending', 'confirmed', 'rejected', 'cancelled']).optional()

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

    const parsedStatus = statusSchema.safeParse(searchParams.get('status') || undefined)
    if (!parsedStatus.success) {
      return NextResponse.json({ error: 'Invalid booking status filter' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('public_bookings')
      .select(`
        *,
        service:services (id, name, est_minutes, price_cents, variable_cost_cents),
        patient:patients (id, first_name, last_name, email, phone),
        treatment:treatments (id, status, treatment_date, treatment_time)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (parsedStatus.data) {
      query = query.eq('status', parsedStatus.data)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('bookings.get error', error)
    return NextResponse.json({ error: 'Failed to fetch booking requests' }, { status: 500 })
  }
}
