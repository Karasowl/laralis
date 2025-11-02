import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'

export const dynamic = 'force-dynamic'

const globalDiscountSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0)
}).refine((data) => {
  if (data.type === 'percentage' && data.value > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['value']
})

/**
 * GET /api/clinics/discount
 * Fetches the global discount configuration for a clinic
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore
    })

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const { data: clinic, error } = await supabaseAdmin
      .from('clinics')
      .select('global_discount_config')
      .eq('id', clinicContext.clinicId)
      .single()

    if (error) {
      console.error('[clinics/discount] Failed to fetch clinic discount config', error)
      return NextResponse.json({ error: 'Failed to fetch discount configuration', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: clinic?.global_discount_config || {
        enabled: false,
        type: 'percentage',
        value: 0
      }
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/clinics/discount:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/clinics/discount
 * Updates the global discount configuration for a clinic
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = globalDiscountSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors.map(err => err.message).join(', ')
      return NextResponse.json({ error: 'Validation failed', message }, { status: 400 })
    }

    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({ cookieStore })

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const discountConfig = parsed.data

    const { error } = await supabaseAdmin
      .from('clinics')
      .update({ global_discount_config: discountConfig })
      .eq('id', clinicContext.clinicId)

    if (error) {
      console.error('[clinics/discount] Failed to update clinic discount config', error)
      return NextResponse.json({ error: 'Failed to update discount configuration', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Global discount configuration updated successfully',
      data: discountConfig
    })
  } catch (error) {
    console.error('Unexpected error in PUT /api/clinics/discount:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
