import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { z } from 'zod'
import { readJson } from '@/lib/validation'
import { listConvexTable, upsertConvexDocumentByLegacyId } from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

// Strip the full Convex metadata set so the row matches a flat Supabase row.
function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

// Postgres text ordering tie-break: compare by code point (matches the C-style
// ordering used across the other migrated routes), not locale.
function byCodePoint(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Convex equivalent of the medications GET query.
 *
 * The Supabase path is `.or('clinic_id.is.null,clinic_id.eq.<clinicId>')`, i.e.
 * GLOBAL medications (clinic_id NULL) PLUS this clinic's own. listConvexDocumentsByClinic
 * would drop the NULL-clinic_id globals, so we read the whole table and filter in JS.
 */
async function getMedicationsFromConvex(
  clinicId: string,
  opts: { activeOnly: boolean; category: string | null; search: string | null }
) {
  const rows = (await listConvexTable('medications', 10000) as ImportedRecord[]).map(normalizeConvexRecord)
  const searchLower = opts.search ? opts.search.toLowerCase() : null

  return rows
    .filter((row) => {
      // .or('clinic_id.is.null,clinic_id.eq.<clinicId>')
      const cid = row.clinic_id
      if (!(cid === null || cid === undefined || String(cid) === clinicId)) return false
      // .eq('is_active', true) when activeOnly
      if (opts.activeOnly && row.is_active !== true) return false
      // .eq('category', category)
      if (opts.category && row.category !== opts.category) return false
      // .or('name.ilike.%search%,generic_name.ilike.%search%')
      if (searchLower) {
        const name = String(row.name ?? '').toLowerCase()
        const generic = String(row.generic_name ?? '').toLowerCase()
        if (!name.includes(searchLower) && !generic.includes(searchLower)) return false
      }
      return true
    })
    .sort((a, b) => byCodePoint(String(a.name ?? ''), String(b.name ?? '')))
}

const medicationSchema = z.object({
  name: z.string().min(1).max(255),
  generic_name: z.string().max(255).optional().nullable(),
  brand_name: z.string().max(255).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  controlled_substance: z.boolean().default(false),
  requires_prescription: z.boolean().default(true),
  dosage_form: z.string().max(100).optional().nullable(),
  strength: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  default_dosage: z.string().max(100).optional().nullable(),
  default_frequency: z.string().max(100).optional().nullable(),
  default_duration: z.string().max(100).optional().nullable(),
  default_instructions: z.string().optional().nullable(),
  common_uses: z.array(z.string()).optional().nullable(),
  contraindications: z.string().optional().nullable(),
  side_effects: z.string().optional().nullable(),
  interactions: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

/**
 * GET /api/medications
 * Fetch all medications (global + clinic-specific)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const searchParams = request.nextUrl.searchParams

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'prescriptions.view')
    if (forbidden) return forbidden

    // Get query params
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('active') !== 'false'

    // Convex read branch (flag-gated, default Supabase). Auth + clinic scoping
    // already enforced above (resolveClinicContext + prescriptions.view guard).
    if (shouldReturnConvexData('medications')) {
      const data = await getMedicationsFromConvex(clinicId, { activeOnly, category, search })
      return NextResponse.json({ data })
    }

    // Build query - get global medications (clinic_id IS NULL) OR clinic-specific
    let query = supabaseAdmin
      .from('medications')
      .select('*')
      .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
      .order('name')

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,generic_name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Medications] Error fetching:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[Medications] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/medications
 * Create a new clinic-specific medication
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const body = bodyResult.data

    const clinicContext = await resolveClinicContext({
      requestedClinicId: body.clinic_id,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'prescriptions.create')
    if (forbidden) return forbidden

    // Validate input
    const validation = medicationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // Convex-only write branch (flag-gated, default Supabase). Auth + clinic scoping
    // already enforced above (resolveClinicContext + prescriptions.create guard).
    // Mirror the Supabase insert: generate the uuid + timestamps Postgres would have
    // defaulted, and spread the same validated columns (always clinic-specific).
    if (shouldUseConvexOnlyWritePath('medications')) {
      const id = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      const row = {
        id,
        clinic_id: clinicId,
        ...data,
        created_at: nowIso,
        updated_at: nowIso,
      }
      await upsertConvexDocumentByLegacyId('medications', id, row)
      return NextResponse.json({ data: row }, { status: 201 })
    }

    // Create medication (always clinic-specific for user-created)
    const { data: medication, error } = await supabaseAdmin
      .from('medications')
      .insert({
        clinic_id: clinicId,
        ...data,
      })
      .select()
      .single()

    if (error) {
      console.error('[Medications] Error creating:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: medication }, { status: 201 })
  } catch (error) {
    console.error('[Medications] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
