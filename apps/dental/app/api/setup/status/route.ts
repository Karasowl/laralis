import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'

// QA route contract: @qa-context-route authenticated setup-status read for current clinic.
export const dynamic = 'force-dynamic'


export async function GET(_request: NextRequest) {
  try {
    const cookieStore = cookies()

    const ctx = await resolveClinicContext({ cookieStore })
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status })
    }
    const { clinicId } = ctx

    // Check time settings
    const { data: timeSettings, error: timeErr } = await supabaseAdmin
      .from('settings_time')
      .select('id')
      .eq('clinic_id', clinicId)
      .limit(1)
      .maybeSingle()

    const hasTime = !!timeSettings && !timeErr

    // Supplies count
    const { count: suppliesCount } = await supabaseAdmin
      .from('supplies')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    // Any service with recipe. service_supplies rows are attached to services,
    // while the clinic ownership lives on services.
    const { data: serviceRows } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('clinic_id', clinicId)

    const serviceIds = (serviceRows || []).map((service) => service.id).filter(Boolean)
    const { count: recipeCount } = serviceIds.length > 0
      ? await supabaseAdmin
          .from('service_supplies')
          .select('service_id', { count: 'exact', head: true })
          .in('service_id', serviceIds)
      : { count: 0 }

    // Presence of fixed costs and assets
    const { count: fixedCount } = await supabaseAdmin
      .from('fixed_costs')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    const { count: assetsCount } = await supabaseAdmin
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    return NextResponse.json({
      data: {
        clinicId,
        hasTime,
        hasFixedCosts: (fixedCount || 0) > 0,
        hasAssets: (assetsCount || 0) > 0,
        suppliesCount: suppliesCount || 0,
        servicesWithRecipeCount: recipeCount || 0,
      }
    })
  } catch (err) {
    console.error('GET /api/setup/status error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
