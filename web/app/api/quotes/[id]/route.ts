import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const quoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional().nullable(),
  service_name: z.string().min(1).max(255),
  service_description: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  unit_price_cents: z.number().int().min(0),
  discount_type: z.enum(['none', 'percentage', 'fixed']).default('none'),
  discount_value: z.number().min(0).default(0),
  tooth_number: z.string().max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
})

const updateQuoteSchema = z.object({
  validity_days: z.number().int().min(1).max(365).optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).optional(),
  discount_type: z.enum(['none', 'percentage', 'fixed']).optional(),
  discount_value: z.number().min(0).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
  patient_notes: z.string().optional().nullable(),
  terms_conditions: z.string().optional().nullable(),
  response_notes: z.string().optional().nullable(),
  items: z.array(quoteItemSchema).min(1).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/quotes/[id]
 * Fetch a single quote with items
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const searchParams = request.nextUrl.searchParams
    const { id } = await params

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

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone, address, city),
        items:quote_items(*, service:services(id, name, description, est_minutes))
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      }
      console.error('[Quotes] Error fetching:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sort items by sort_order
    if (data.items) {
      data.items.sort((a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[Quotes] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/quotes/[id]
 * Update a quote
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const body = await request.json()
    const { id } = await params

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

    // Verify quote belongs to clinic
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('quotes')
      .select('id, status')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Validate input
    const validation = updateQuoteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { items, ...quoteData } = validation.data

    // Handle status change timestamps
    if (quoteData.status === 'sent' && existing.status !== 'sent') {
      Object.assign(quoteData, { sent_at: new Date().toISOString() })
    }
    if (['accepted', 'rejected'].includes(quoteData.status || '') &&
        !['accepted', 'rejected'].includes(existing.status)) {
      Object.assign(quoteData, { responded_at: new Date().toISOString() })
    }

    // Update quote
    if (Object.keys(quoteData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('quotes')
        .update(quoteData)
        .eq('id', id)

      if (updateError) {
        console.error('[Quotes] Error updating:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Update items if provided
    if (items && items.length > 0) {
      // Delete existing items
      await supabaseAdmin
        .from('quote_items')
        .delete()
        .eq('quote_id', id)

      // Insert new items
      const itemsToInsert = items.map((item, index) => ({
        quote_id: id,
        service_id: item.service_id,
        service_name: item.service_name,
        service_description: item.service_description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        tooth_number: item.tooth_number,
        notes: item.notes,
        sort_order: item.sort_order ?? index,
        subtotal_cents: item.quantity * item.unit_price_cents,
        total_cents: item.quantity * item.unit_price_cents,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('quote_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('[Quotes] Error updating items:', itemsError)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    // Fetch updated quote
    const { data: updated, error: fetchError } = await supabaseAdmin
      .from('quotes')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone),
        items:quote_items(*)
      `)
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: { id } }, { status: 200 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[Quotes] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/quotes/[id]
 * Delete a quote (only drafts can be deleted)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const searchParams = request.nextUrl.searchParams
    const { id } = await params

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

    // Check if quote is draft
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('quotes')
      .select('status')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft quotes can be deleted' },
        { status: 400 }
      )
    }

    // Delete quote (cascade deletes items)
    const { error } = await supabaseAdmin
      .from('quotes')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      console.error('[Quotes] Error deleting:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Quote deleted successfully' })
  } catch (error) {
    console.error('[Quotes] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
