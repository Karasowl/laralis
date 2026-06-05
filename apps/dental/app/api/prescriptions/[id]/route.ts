import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { z } from 'zod'
import { readJson } from '@/lib/validation'
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexTable,
} from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

/**
 * Strip the full Convex metadata set so the response shape matches the
 * Supabase row byte-for-byte (Supabase rows carry none of these fields).
 */
function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const {
    _id,
    _creationTime,
    legacyId,
    legacyTable,
    convex_created_at,
    convex_updated_at,
    convex_snapshot_source,
    ...rest
  } = row
  return rest
}

/** Index rows by both their business `id` and `legacyId` for FK lookups. */
function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
      return ids.map((id) => [id, row] as const)
    })
  )
}

/**
 * Mirror a Supabase nested `.select(col, col, ...)` projection: returns an
 * object containing exactly `keys` (null for missing/orphaned FK), or null
 * when the referenced row does not exist (left-join semantics).
 */
function pick(row: ImportedRecord | null | undefined, keys: string[]) {
  if (!row) return null
  const out: Record<string, any> = {}
  for (const key of keys) out[key] = row[key] ?? null
  return out
}

/**
 * Convex has no relational joins / nested select, so we fetch each related
 * table separately and reassemble the nested object graph exactly mirroring
 * the Supabase GET query:
 *   prescriptions
 *     *,
 *     patient:patients(id, first_name, last_name, email, phone, birth_date, address),
 *     treatment:treatments(id, treatment_date, service:services(id, name)),
 *     items:prescription_items(*, medication:medications(*))
 *   .eq('id', id).eq('clinic_id', clinicId).single()
 *
 * Returns null when the prescription is missing or belongs to another clinic
 * (parity with PGRST116 / the clinic_id filter -> 404 at the call site).
 */
async function getPrescriptionFromConvex(prescriptionId: string, clinicId: string) {
  // prescriptions HAS clinic_id (NOT NULL) -> fetch single doc by id, then
  // enforce the clinic_id filter to mirror .eq('clinic_id', clinicId).
  const prescription = (await getConvexDocumentByLegacyId(
    'prescriptions',
    prescriptionId
  )) as ImportedRecord | null

  if (!prescription || String(prescription.clinic_id) !== String(clinicId)) {
    return null
  }

  // patients/treatments/services HAVE clinic_id (NOT NULL) -> clinic-scoped accessor.
  // prescription_items has NO clinic_id (child by prescription_id) -> full table + FK filter.
  // medications has a NULLABLE clinic_id (global meds = NULL); listByClinic would
  // silently drop global rows, so use the full table + FK lookup to match the
  // Supabase medication:medications(*) join (resolves by medication_id regardless of scope).
  const [patients, treatments, services, items, medications] = await Promise.all([
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexTable('prescription_items', 10000) as Promise<ImportedRecord[]>,
    listConvexTable('medications', 10000) as Promise<ImportedRecord[]>,
  ])

  const patientsById = byId(patients)
  const treatmentsById = byId(treatments)
  const servicesById = byId(services)
  const medicationsById = byId(medications)

  // items:prescription_items(*) -> child rows filtered by FK, count-checked.
  const childItems = items.filter(
    (row) => String(row.prescription_id) === String(prescriptionId)
  )
  const reassembledItems = childItems.map((item) => ({
    ...normalizeConvexRecord(item),
    // medication:medications(*) -> full medication row by medication_id, null when
    // medication_id is null (custom/one-off) or the FK is orphaned (left join).
    medication: item.medication_id
      ? normalizeConvexRecord(medicationsById.get(String(item.medication_id)))
      : null,
  }))

  // treatment:treatments(id, treatment_date, service:services(id, name))
  const treatmentRow = prescription.treatment_id
    ? treatmentsById.get(String(prescription.treatment_id))
    : null
  const treatment = treatmentRow
    ? {
        ...pick(treatmentRow, ['id', 'treatment_date']),
        service: treatmentRow.service_id
          ? pick(servicesById.get(String(treatmentRow.service_id)), ['id', 'name'])
          : null,
      }
    : null

  return {
    ...normalizeConvexRecord(prescription),
    // patient:patients(id, first_name, last_name, email, phone, birth_date, address)
    patient: prescription.patient_id
      ? pick(patientsById.get(String(prescription.patient_id)), [
          'id',
          'first_name',
          'last_name',
          'email',
          'phone',
          'birth_date',
          'address',
        ])
      : null,
    treatment,
    items: reassembledItems,
  }
}

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

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'prescriptions.view')
    if (forbidden) return forbidden

    // Convex read branch: auth-guarded by resolveClinicContext (getUser +
    // hasClinicAccess -> 403) and the prescriptions.view permission above, since
    // the Convex bridge has no RLS. Placed before the Supabase query so the read
    // path is fully replaced when the flag is on.
    if (shouldReturnConvexData('prescriptions')) {
      const data = await getPrescriptionFromConvex(id, clinicId)
      if (!data) {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
      }
      return NextResponse.json({ data })
    }

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
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const body = bodyResult.data
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

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'prescriptions.edit')
    if (forbidden) return forbidden

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

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'prescriptions.delete')
    if (forbidden) return forbidden

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
