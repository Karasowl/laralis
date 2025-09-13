import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getClinicIdOrDefault } from '@/lib/clinic'

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createSupabaseClient(cookieStore)

    const clinicId = await getClinicIdOrDefault(cookieStore)
    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 })
    }

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

    // Any service with recipe
    const { count: recipeCount } = await supabaseAdmin
      .from('service_supplies')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

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
