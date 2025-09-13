import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseClient } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getClinicIdOrDefault } from '@/lib/clinic'

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createSupabaseClient(cookieStore)

    const clinicId = await getClinicIdOrDefault(cookieStore)
    if (!clinicId) return NextResponse.json({ error: 'No clinic context available' }, { status: 400 })

    // Time settings
    const { data: time, error: timeErr } = await supabaseAdmin
      .from('settings_time')
      .select('work_days, hours_per_day, real_pct')
      .eq('clinic_id', clinicId)
      .limit(1)
      .maybeSingle()

    if (timeErr) {
      console.error('cost-per-minute: time settings error', timeErr)
    }

    // Fixed costs total
    const { data: fixedCosts, error: fixedErr } = await supabaseAdmin
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId)

    if (fixedErr) console.error('cost-per-minute: fixed costs error', fixedErr)

    // Assets monthly depreciation
    const { data: assets, error: assetsErr } = await supabaseAdmin
      .from('assets')
      .select('purchase_price_cents, depreciation_months')
      .eq('clinic_id', clinicId)

    if (assetsErr) console.error('cost-per-minute: assets error', assetsErr)

    const monthlyFixedCostsCents = (fixedCosts || []).reduce((sum, c: any) => sum + (c.amount_cents || 0), 0)
      + (assets || []).reduce((sum, a: any) => {
        if (!a.depreciation_months || a.depreciation_months <= 0) return sum
        return sum + Math.round(a.purchase_price_cents / a.depreciation_months)
      }, 0)

    let perMinute = 0
    let effectiveMinutes = 0
    let minutesMonth = 0
    let realPctMode: 'decimal' | 'percent' | 'unknown' = 'unknown'

    if (time) {
      minutesMonth = (time.work_days || 0) * (time.hours_per_day || 0) * 60
      let rp = Number(time.real_pct ?? 0)
      if (rp > 1) { realPctMode = 'percent'; rp = rp / 100 } else { realPctMode = 'decimal' }
      if (rp < 0) rp = 0
      if (rp > 1) rp = 1
      effectiveMinutes = Math.round(minutesMonth * rp)
      if (effectiveMinutes > 0 && monthlyFixedCostsCents > 0) {
        perMinute = Math.round(monthlyFixedCostsCents / effectiveMinutes)
      }
    }

    return NextResponse.json({
      data: {
        per_minute_cents: perMinute,
        per_hour_cents: perMinute * 60,
        monthly_fixed_cents: monthlyFixedCostsCents,
        effective_minutes_per_month: effectiveMinutes,
        inputs: time ? {
          work_days: time.work_days,
          hours_per_day: time.hours_per_day,
          real_pct: Number(time.real_pct),
          real_pct_mode: realPctMode,
          minutes_per_month: minutesMonth,
        } : null
      }
    })
  } catch (e) {
    console.error('GET /api/time/cost-per-minute error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
