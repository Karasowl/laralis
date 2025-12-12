import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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

    const { clinicId } = clinicContext

    // Get query params
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('active') !== 'false'

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
    const body = await request.json()

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

    const { clinicId } = clinicContext

    // Validate input
    const validation = medicationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const data = validation.data

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
