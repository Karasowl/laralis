import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const prescriptionItemSchema = z.object({
  id: z.string().uuid().optional(),
  medication_id: z.string().uuid().optional().nullable(),
  medication_name: z.string().min(1).max(255),
  medication_strength: z.string().max(100).optional().nullable(),
  medication_form: z.string().max(100).optional().nullable(),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  duration: z.string().max(100).optional().nullable(),
  quantity: z.string().max(100).optional().nullable(),
  instructions: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
})

const updatePrescriptionSchema = z.object({
  prescriber_name: z.string().min(1).max(255).optional(),
  prescriber_license: z.string().max(100).optional().nullable(),
  prescriber_specialty: z.string().max(100).optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  status: z.enum(['active', 'cancelled', 'expired', 'dispensed']).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().optional().nullable(),
  pharmacy_notes: z.string().optional().nullable(),
  items: z.array(prescriptionItemSchema).min(1).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/prescriptions/[id]
 * Fetch a single prescription with items
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
      .from('prescriptions')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone, birth_date, address),
        treatment:treatments(id, treatment_date, service:services(id, name)),
        items:prescription_items(*, medication:medications(*))
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
      }
      console.error('[Prescriptions] Error fetching:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[Prescriptions] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/prescriptions/[id]
 * Update a prescription
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

    // Verify prescription belongs to clinic
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('prescriptions')
      .select('id, status')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    }

    // Validate input
    const validation = updatePrescriptionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { items, ...prescriptionData } = validation.data

    // Update prescription
    if (Object.keys(prescriptionData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('prescriptions')
        .update(prescriptionData)
        .eq('id', id)

      if (updateError) {
        console.error('[Prescriptions] Error updating:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Update items if provided
    if (items && items.length > 0) {
      // Delete existing items
      await supabaseAdmin
        .from('prescription_items')
        .delete()
        .eq('prescription_id', id)

      // Insert new items
      const itemsToInsert = items.map((item, index) => ({
        prescription_id: id,
        medication_id: item.medication_id,
        medication_name: item.medication_name,
        medication_strength: item.medication_strength,
        medication_form: item.medication_form,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
        sort_order: item.sort_order ?? index,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('prescription_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('[Prescriptions] Error updating items:', itemsError)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    // Fetch updated prescription
    const { data: updated, error: fetchError } = await supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone),
        items:prescription_items(*)
      `)
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: { id } }, { status: 200 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[Prescriptions] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/prescriptions/[id]
 * Delete a prescription (soft delete by setting status to cancelled)
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

    // Soft delete by setting status to cancelled
    const { error } = await supabaseAdmin
      .from('prescriptions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      console.error('[Prescriptions] Error deleting:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Prescription cancelled successfully' })
  } catch (error) {
    console.error('[Prescriptions] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
