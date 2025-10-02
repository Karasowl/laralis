import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'

const tariffItemSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  clinic_id: z.string().min(1, 'clinic_id is required'),
  margin_percentage: z.coerce.number().min(0).max(100),
  final_price_cents: z.coerce.number().int().nonnegative(),
  is_active: z.boolean().optional()
})

const saveTariffsSchema = z.object({
  tariffs: z.array(tariffItemSchema).min(1, 'At least one tariff is required')
})

interface ClinicCostContext {
  costPerMinuteCents: number
  ready: boolean
}

const clinicCostCache = new Map<string, ClinicCostContext>()

async function getClinicCostContext(clinicId: string): Promise<ClinicCostContext> {
  if (clinicCostCache.has(clinicId)) {
    return clinicCostCache.get(clinicId) as ClinicCostContext
  }

  const [{ data: settings, error: settingsError }, { data: fixedCosts, error: fixedError }, { data: assets, error: assetsError }] = await Promise.all([
    supabaseAdmin
      .from('settings_time')
      .select('work_days, hours_per_day, real_pct')
      .eq('clinic_id', clinicId)
      .single(),
    supabaseAdmin
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId),
    supabaseAdmin
      .from('assets')
      .select('purchase_price_cents, depreciation_months')
      .eq('clinic_id', clinicId)
  ])

  if (settingsError) {
    console.error('[tariffs] Unable to read settings_time', settingsError)
  }
  if (fixedError) {
    console.error('[tariffs] Unable to read fixed_costs', fixedError)
  }
  if (assetsError) {
    console.error('[tariffs] Unable to read assets', assetsError)
  }

  const totalFixedCostsCents = (fixedCosts || []).reduce((sum, row) => sum + Number(row.amount_cents || 0), 0)
  const monthlyAssetDepCents = (assets || []).reduce((sum, asset) => {
    const months = Number(asset.depreciation_months || 0)
    if (months <= 0) return sum
    return sum + Math.round(Number(asset.purchase_price_cents || 0) / months)
  }, 0)

  const workDays = Number(settings?.work_days || 0)
  const hoursPerDay = Number(settings?.hours_per_day || 0)
  const realPct = Number(settings?.real_pct || 0)
  const realPctDecimal = realPct > 1 ? realPct / 100 : realPct
  const minutesPerMonth = workDays * hoursPerDay * 60
  const effectiveMinutes = Math.round(minutesPerMonth * Math.max(0, Math.min(1, realPctDecimal)))

  const totalFixed = totalFixedCostsCents + monthlyAssetDepCents
  const costPerMinute = effectiveMinutes > 0 ? Math.round(totalFixed / effectiveMinutes) : 0

  const context: ClinicCostContext = {
    costPerMinuteCents: costPerMinute,
    ready: Boolean(settings) && totalFixed > 0 && effectiveMinutes > 0
  }

  clinicCostCache.set(clinicId, context)
  return context
}

async function getServiceCosts(serviceId: string, clinicId: string) {
  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .select('id, clinic_id, est_minutes')
    .eq('id', serviceId)
    .eq('clinic_id', clinicId)
    .single()

  if (serviceError) {
    if (serviceError.code === 'PGRST116') {
      return { error: NextResponse.json({ error: 'Service not found' }, { status: 404 }) }
    }

    console.error('[tariffs] Unable to fetch service', serviceError)
    return { error: NextResponse.json({ error: 'Failed to fetch service', message: serviceError.message }, { status: 500 }) }
  }

  const { data: serviceSupplies, error: suppliesError } = await supabaseAdmin
    .from('service_supplies')
    .select('qty, supplies!service_supplies_supply_id_fkey(price_cents, portions)')
    .eq('service_id', serviceId)

  if (suppliesError) {
    console.error('[tariffs] Unable to fetch service supplies', suppliesError)
    return { error: NextResponse.json({ error: 'Failed to fetch service supplies', message: suppliesError.message }, { status: 500 }) }
  }

  const variableCostCents = (serviceSupplies || []).reduce((sum, item) => {
    const supply: any = item.supplies
    if (!supply || !item.qty) return sum
    const portions = Number(supply.portions || 0)
    if (portions <= 0) return sum
    const qty = Number(item.qty || 0)
    const price = Number(supply.price_cents || 0)
    const costPerPortion = price / portions
    return sum + Math.round(costPerPortion * qty)
  }, 0)

  return {
    service,
    variableCostCents
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = saveTariffsSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors.map(err => err.message).join(', ')
      return NextResponse.json({ error: 'Validation failed', message }, { status: 400 })
    }

    const tariffItems = parsed.data.tariffs
    const cookieStore = cookies()

    // Ensure caller has access to the clinic context
    const clinicContext = await resolveClinicContext({ cookieStore })
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const today = new Date().toISOString().split('T')[0]
    const rows: any[] = []

    for (const item of tariffItems) {
      if (item.clinic_id !== clinicContext.clinicId) {
        return NextResponse.json({ error: 'clinic_mismatch', message: 'Clinic mismatch detected' }, { status: 403 })
      }

      const clinicCosts = await getClinicCostContext(item.clinic_id)
      if (!clinicCosts.ready) {
        return NextResponse.json({ error: 'precondition_failed', message: 'Time settings and fixed costs must be configured before saving tariffs.' }, { status: 412 })
      }

      const serviceCosts = await getServiceCosts(item.service_id, item.clinic_id)
      if ('error' in serviceCosts) {
        return serviceCosts.error
      }

      const estMinutes = Number(serviceCosts.service.est_minutes || 0)
      if (!estMinutes || estMinutes <= 0) {
        return NextResponse.json({ error: 'precondition_failed', message: 'Service must define estimated minutes before assigning a tariff.' }, { status: 412 })
      }

      const fixedPerMinute = clinicCosts.costPerMinuteCents
      const fixedCostCents = Math.round(fixedPerMinute * estMinutes)
      const variableCostCents = serviceCosts.variableCostCents
      const baseCostCents = fixedCostCents + variableCostCents
      const marginPct = item.margin_percentage
      const marginAmountCents = Math.round(baseCostCents * (marginPct / 100))
      const priceCents = baseCostCents + marginAmountCents

      rows.push({
        clinic_id: item.clinic_id,
        service_id: item.service_id,
        version: 1,
        valid_from: today,
        valid_until: null,
        fixed_cost_per_minute_cents: fixedPerMinute,
        variable_cost_cents: variableCostCents,
        margin_pct: marginPct,
        price_cents: priceCents,
        rounded_price_cents: item.final_price_cents,
        is_active: item.is_active ?? true
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 200 })
    }

    const { error: upsertError } = await supabaseAdmin
      .from('tariffs')
      .upsert(rows, { onConflict: 'service_id,version' })

    if (upsertError) {
      console.error('[tariffs] Failed to upsert tariffs', upsertError)
      return NextResponse.json({ error: 'Failed to save tariffs', message: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tariffs saved successfully' })
  } catch (error) {
    console.error('Unexpected error in POST /api/tariffs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore })

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const { data, error } = await supabaseAdmin
      .from('tariffs')
      .select('*')
      .eq('clinic_id', clinicContext.clinicId)
      .order('service_id', { ascending: true })

    if (error) {
      console.error('[tariffs] Failed to fetch tariffs', error)
      return NextResponse.json({ error: 'Failed to fetch tariffs', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Unexpected error in GET /api/tariffs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
