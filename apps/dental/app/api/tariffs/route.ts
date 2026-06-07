import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { readJson } from '@/lib/validation'

export const dynamic = 'force-dynamic'


import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { calcularPrecioConDescuento } from '@/lib/calc/tarifa'
import {
  listConvexDocumentsByClinic,
  listConvexTable,
  getConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

// GET reads from the clinic-scoped `tariffs` table (clinic_id NOT NULL per mig 16)
// with a flat `select('*')` — there are NO nested joins in the read path, so the
// Convex branch mirrors that flat shape exactly. The per-service cost aggregation
// (service + service_supplies + supplies recipe) lives in the POST helpers only.
async function getTariffsFromConvex(clinicId: string) {
  const rows = await listConvexDocumentsByClinic('tariffs', clinicId, 10000) as ImportedRecord[]

  return rows
    .map(normalizeConvexRecord)
    .filter((row): row is ImportedRecord => row !== null)
    // Codepoint compare (not localeCompare) to match Postgres UUID byte
    // ordering of .order('service_id'); avoids locale-dependent drift.
    .sort((a, b) => {
      const x = String(a.service_id || ''), y = String(b.service_id || '')
      return x < y ? -1 : x > y ? 1 : 0
    })
}

const tariffItemSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  clinic_id: z.string().min(1, 'clinic_id is required'),
  margin_percentage: z.coerce
    .number()
    .min(0, 'Margin must be at least 0% (allows promotions/offers)')
    .max(300, 'Margin must not exceed 300% (check for input errors)'),
  final_price_cents: z.coerce.number().int().nonnegative(),
  is_active: z.boolean().optional(),
  discount_type: z.enum(['none', 'percentage', 'fixed']).optional(),
  discount_value: z.coerce.number().min(0).optional(),
  discount_reason: z.string().optional()
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

// ----------------------------------------------------------------------------
// Convex-only write path (DATA_WRITE_MODE_TARIFFS=convex).
//
// In convex-only mode supabaseAdmin is unreachable, so getClinicCostContext +
// getServiceCosts (both supabaseAdmin-backed) would throw on their first .from()
// call. These helpers replicate that exact cost math against the Convex bridge,
// mirroring the already-ported services/[id]/cost convex branch field-for-field:
//   - clinic cost-per-minute from settings_time + fixed_costs + assets,
//   - per-service variable cost from service_supplies x supplies recipe.
// The bridge has no SQL joins, so service_supplies is read flat and linked to
// supplies in JS (same pattern as services/[id]/cost). It also has no RLS, but
// resolveClinicContext + forbiddenIfMissingPermission already gated the caller,
// and the clinic_id === clinicContext.clinicId guard runs per-item before any
// Convex read here.
async function getClinicCostContextFromConvex(clinicId: string): Promise<ClinicCostContext> {
  if (clinicCostCache.has(clinicId)) {
    return clinicCostCache.get(clinicId) as ClinicCostContext
  }

  const [timeRows, fixedCosts, assets] = await Promise.all([
    listConvexDocumentsByClinic('settings_time', clinicId, 10) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('fixed_costs', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('assets', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  const settings = timeRows[0] || null

  const totalFixedCostsCents = fixedCosts.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0)
  const monthlyAssetDepCents = assets.reduce((sum, asset) => {
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

async function getServiceCostsFromConvex(serviceId: string, clinicId: string) {
  const service = (await getConvexDocumentByLegacyId('services', serviceId)) as ImportedRecord | null
  if (!service || String(service.clinic_id) !== clinicId) {
    return { error: NextResponse.json({ error: 'Service not found' }, { status: 404 }) }
  }

  // No SQL join on the bridge: read service_supplies flat + supplies for the
  // clinic, then link by supply_id (mirrors services/[id]/cost convex branch).
  const [serviceSupplies, supplies] = await Promise.all([
    listConvexTable('service_supplies') as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('supplies', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  const suppliesById = new Map<string, ImportedRecord>()
  for (const row of supplies) {
    for (const id of [row.id, row.legacyId].filter(Boolean)) {
      suppliesById.set(String(id), row)
    }
  }

  const variableCostCents = serviceSupplies.reduce((sum, item) => {
    if (String(item.service_id) !== serviceId && String(item.serviceId) !== serviceId) return sum
    const supply = item.supply_id ? suppliesById.get(String(item.supply_id)) : null
    if (!supply) return sum
    const portions = Number(supply.portions || 0)
    if (portions <= 0) return sum
    const qty = Number(item.qty || 0)
    if (qty <= 0) return sum
    const price = Number(supply.price_cents || 0)
    const costPerPortion = price / portions
    return sum + Math.round(costPerPortion * qty)
  }, 0)

  return {
    service: { id: service.id, clinic_id: service.clinic_id, est_minutes: service.est_minutes },
    variableCostCents
  }
}

/**
 * Replicate the Supabase upsert(rows, { onConflict: 'service_id,version' }) on the
 * Convex bridge. The Postgres conflict target is (service_id, version) — NOT the
 * `id` PK — so each (service_id, version) maps to a SINGLE tariff row: reuse the
 * existing convex tariff's id when present so an edit patches in place (no
 * duplicate), otherwise mint a fresh UUID for the insert. The clinic-scoped read
 * + service_id index is exact because version is hard-coded to 1 in the rows.
 */
async function upsertTariffsInConvex(rows: ImportedRecord[], clinicId: string) {
  const existing = (await listConvexDocumentsByClinic('tariffs', clinicId, 10000)) as ImportedRecord[]
  const idByServiceVersion = new Map<string, string>()
  for (const row of existing) {
    const key = `${String(row.service_id)}:${Number(row.version ?? 1)}`
    const legacyId = row.id ?? row.legacyId
    if (legacyId !== undefined && legacyId !== null) {
      idByServiceVersion.set(key, String(legacyId))
    }
  }

  const now = new Date().toISOString()

  for (const row of rows) {
    const key = `${String(row.service_id)}:${Number(row.version ?? 1)}`
    const tariffId = idByServiceVersion.get(key) ?? crypto.randomUUID()

    // Postgres-default columns Convex does not fill automatically (id/created_at/
    // updated_at). is_active is already set explicitly on the row by the caller.
    const record: ImportedRecord = {
      id: tariffId,
      created_at: now,
      updated_at: now,
      ...row,
    }

    await upsertConvexDocumentByLegacyId('tariffs', tariffId, record)
  }
}

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const body = bodyResult.data
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
    const forbidden = await forbiddenIfMissingPermission(
      clinicContext.userId,
      clinicContext.clinicId,
      'services.set_prices'
    )
    if (forbidden) return forbidden

    // Convex-only write path: supabaseAdmin is unreachable, so the cost-context
    // reads and the final upsert must go through the Convex bridge instead.
    const convexOnly = shouldUseConvexOnlyWritePath('tariffs')

    const today = new Date().toISOString().split('T')[0]
    const rows: any[] = []

    for (const item of tariffItems) {
      if (item.clinic_id !== clinicContext.clinicId) {
        return NextResponse.json({ error: 'clinic_mismatch', message: 'Clinic mismatch detected' }, { status: 403 })
      }

      const clinicCosts = convexOnly
        ? await getClinicCostContextFromConvex(item.clinic_id)
        : await getClinicCostContext(item.clinic_id)
      if (!clinicCosts.ready) {
        return NextResponse.json({ error: 'precondition_failed', message: 'Time settings and fixed costs must be configured before saving tariffs.' }, { status: 412 })
      }

      // Critical validation: Ensure cost per minute is not zero
      if (clinicCosts.costPerMinuteCents <= 0) {
        return NextResponse.json({
          error: 'invalid_cost_structure',
          message: 'Cost per minute is zero or negative. Please configure at least one fixed cost or asset before creating tariffs.',
          details: {
            costPerMinuteCents: clinicCosts.costPerMinuteCents
          }
        }, { status: 400 })
      }

      // Warning: Low cost per minute (less than $0.50/min = 50 cents)
      if (clinicCosts.costPerMinuteCents < 50) {
        console.warn(`[tariffs] Low cost per minute detected for clinic ${item.clinic_id}: ${clinicCosts.costPerMinuteCents} cents/min. This may result in unrealistic pricing.`)
      }

      const serviceCosts = convexOnly
        ? await getServiceCostsFromConvex(item.service_id, item.clinic_id)
        : await getServiceCosts(item.service_id, item.clinic_id)
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

      // FIX: Use the FIXED price configured by user, not recalculated price
      // The user decides the price, we calculate the REAL margin based on current costs
      const userConfiguredPriceCents = item.final_price_cents

      // Calculate REAL margin percentage based on configured price and current costs
      // realMarginPct = (price - cost) / cost × 100
      const realMarginPct = baseCostCents > 0
        ? ((userConfiguredPriceCents - baseCostCents) / baseCostCents) * 100
        : 0

      // Calculate discounted price if discount is provided
      const discountType = item.discount_type || 'none'
      const discountValue = item.discount_value || 0
      let finalPriceWithDiscountCents = userConfiguredPriceCents

      if (discountType !== 'none' && discountValue > 0) {
        finalPriceWithDiscountCents = calcularPrecioConDescuento(
          userConfiguredPriceCents,
          discountType,
          discountValue
        )
      }

      rows.push({
        clinic_id: item.clinic_id,
        service_id: item.service_id,
        version: 1,
        valid_from: today,
        valid_until: null,
        fixed_cost_per_minute_cents: fixedPerMinute,
        variable_cost_cents: variableCostCents,
        margin_pct: realMarginPct,  // Store REAL margin, not configured margin
        price_cents: userConfiguredPriceCents,  // Store user's FIXED price
        rounded_price_cents: userConfiguredPriceCents,  // Same as price_cents
        is_active: item.is_active ?? true,
        discount_type: discountType,
        discount_value: discountValue,
        discount_reason: item.discount_reason || null,
        final_price_with_discount_cents: finalPriceWithDiscountCents
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 200 })
    }

    if (convexOnly) {
      // Replicates upsert(rows, { onConflict: 'service_id,version' }) on the bridge.
      await upsertTariffsInConvex(rows, clinicContext.clinicId)
      return NextResponse.json({ message: 'Tariffs saved successfully' })
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
    const forbidden = await forbiddenIfMissingPermission(
      clinicContext.userId,
      clinicContext.clinicId,
      'financial_reports.view'
    )
    if (forbidden) return forbidden

    // Convex read branch (flag-gated). Auth + clinic access already enforced above
    // via resolveClinicContext + forbiddenIfMissingPermission, so the Convex bridge
    // (which has no RLS) is safe to query for this clinic here.
    if (shouldReturnConvexData('tariffs')) {
      const data = await getTariffsFromConvex(clinicContext.clinicId)
      return NextResponse.json({ data })
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
