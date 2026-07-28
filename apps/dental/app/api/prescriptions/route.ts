import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { z } from 'zod'
import { readJson } from '@/lib/validation'
import {
  listConvexDocumentsByClinic,
  listConvexTable,
  getConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

function buildPatientLookup(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
      return ids.map((id) => [id, row] as const)
    })
  )
}

interface PrescriptionConvexFilters {
  patientId: string | null
  treatmentId: string | null
  status: string | null
  startDate: string | null
  endDate: string | null
}

async function getPrescriptionsFromConvex(clinicId: string, filters: PrescriptionConvexFilters) {
  const [prescriptions, patients, items] = await Promise.all([
    listConvexDocumentsByClinic('prescriptions', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
    // prescription_items has NO clinic_id column; scope by FK prescription_id via JS filter
    listConvexTable('prescription_items', 10000) as Promise<ImportedRecord[]>,
  ])

  const patientsById = buildPatientLookup(patients)

  // Group items by prescription_id (Convex has no joins)
  const itemsByPrescription = new Map<string, ImportedRecord[]>()
  for (const item of items) {
    const prescriptionId = item.prescription_id != null ? String(item.prescription_id) : null
    if (!prescriptionId) continue
    const bucket = itemsByPrescription.get(prescriptionId)
    if (bucket) {
      bucket.push(item)
    } else {
      itemsByPrescription.set(prescriptionId, [item])
    }
  }

  const buildPatientEmbed = (patientId: string | null | undefined) => {
    if (!patientId) return null
    const patient = patientsById.get(String(patientId))
    if (!patient) return null
    return {
      id: patient.id ?? patient.legacyId ?? null,
      first_name: patient.first_name ?? null,
      last_name: patient.last_name ?? null,
      email: patient.email ?? null,
      phone: patient.phone ?? null,
    }
  }

  return prescriptions
    .filter((row) => {
      if (filters.patientId && String(row.patient_id) !== filters.patientId) return false
      if (filters.treatmentId && String(row.treatment_id) !== filters.treatmentId) return false
      if (filters.status && row.status !== filters.status) return false
      if (filters.startDate && String(row.prescription_date || '') < filters.startDate) return false
      if (filters.endDate && String(row.prescription_date || '') > filters.endDate) return false
      return true
    })
    .sort((a, b) => String(b.prescription_date || '').localeCompare(String(a.prescription_date || '')))
    .map((row) => {
      const prescriptionId = row.id != null ? String(row.id) : (row.legacyId != null ? String(row.legacyId) : null)
      const relatedItems = prescriptionId ? (itemsByPrescription.get(prescriptionId) || []) : []
      return {
        ...normalizeConvexRecord(row),
        patient: buildPatientEmbed(row.patient_id),
        items: relatedItems.map(normalizeConvexRecord),
      }
    })
}

/**
 * Convex parity for the Postgres BEFORE INSERT trigger
 * `generate_prescription_number` (migration 64): produces a per-clinic, per-year
 * sequential number formatted `YYYY-XXXXX` (e.g. 2025-00001). Mirrors the SQL:
 *   next = COALESCE(MAX(CAST(SUBSTRING(prescription_number FROM 6) AS int)), 0) + 1
 *   WHERE clinic_id = NEW.clinic_id AND prescription_number LIKE 'YYYY-%'
 * In Convex-only mode there is no trigger, so we compute the next number from the
 * existing clinic prescriptions before writing.
 */
async function generateConvexPrescriptionNumber(clinicId: string): Promise<string> {
  const yearPrefix = String(new Date().getFullYear())
  const existing = (await listConvexDocumentsByClinic(
    'prescriptions',
    clinicId,
    10000
  )) as ImportedRecord[]

  let maxSeq = 0
  for (const row of existing) {
    const number = typeof row.prescription_number === 'string' ? row.prescription_number : null
    if (!number || !number.startsWith(`${yearPrefix}-`)) continue
    // SUBSTRING(... FROM 6) -> everything after the `YYYY-` prefix (5 chars).
    const seq = Number.parseInt(number.slice(5), 10)
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
  }

  return `${yearPrefix}-${String(maxSeq + 1).padStart(5, '0')}`
}

// Helper to transform empty strings to undefined
const emptyToUndefined = z.string().transform(val => val === '' ? undefined : val)
const optionalString = emptyToUndefined.optional()

const prescriptionItemSchema = z.object({
  medication_id: z.string().uuid().optional().nullable(),
  medication_name: z.string().min(1).max(255),
  medication_strength: optionalString,
  medication_form: optionalString,
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  duration: optionalString,
  quantity: optionalString,
  instructions: optionalString,
  sort_order: z.number().int().default(0),
})

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const optionalDateString = z.string().optional().transform(val => {
  if (!val || val === '') return undefined
  if (!dateRegex.test(val)) return undefined
  return val
})

const prescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  treatment_id: z.string().uuid().optional().nullable(),
  prescription_date: z.string().regex(dateRegex, 'Invalid date format'),
  prescriber_name: z.string().min(1).max(255),
  prescriber_license: optionalString,
  prescriber_specialty: optionalString,
  diagnosis: optionalString,
  valid_until: optionalDateString,
  notes: optionalString,
  pharmacy_notes: optionalString,
  items: z.array(prescriptionItemSchema).min(1, 'At least one medication is required'),
})

/**
 * GET /api/prescriptions
 * Fetch prescriptions with optional filters
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
    const patientId = searchParams.get('patientId')
    const treatmentId = searchParams.get('treatmentId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (shouldReturnConvexData('prescriptions')) {
      const data = await getPrescriptionsFromConvex(clinicId, {
        patientId,
        treatmentId,
        status,
        startDate,
        endDate,
      })
      return NextResponse.json({ data })
    }

    // Build query
    let query = supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone),
        items:prescription_items(*)
      `)
      .eq('clinic_id', clinicId)
      .order('prescription_date', { ascending: false })

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    if (treatmentId) {
      query = query.eq('treatment_id', treatmentId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('prescription_date', startDate)
    }

    if (endDate) {
      query = query.lte('prescription_date', endDate)
    }

    const { data, error } = await query

    if (error) {
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
 * POST /api/prescriptions
 * Create a new prescription with items
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
    const validation = prescriptionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { items, ...prescriptionData } = validation.data

    // Convex-only write branch: auth/permission already enforced above
    // (resolveClinicContext + prescriptions.create). Supabase is unreachable in
    // this mode, so the patient verification, prescription insert, prescription
    // number generation (Postgres trigger), and child item inserts are all
    // replicated against Convex before the Supabase write path.
    if (shouldUseConvexOnlyWritePath('prescriptions')) {
      // Verify patient belongs to clinic (mirror .eq('id').eq('clinic_id').single()).
      const patientRow = (await getConvexDocumentByLegacyId(
        'patients',
        prescriptionData.patient_id
      )) as ImportedRecord | null
      if (!patientRow || String(patientRow.clinic_id) !== String(clinicId)) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }

      const nowIso = new Date().toISOString()
      const prescriptionId = crypto.randomUUID()
      const prescriptionNumber = await generateConvexPrescriptionNumber(clinicId)

      // Build the prescription row exactly like the Supabase insert: explicit
      // columns (clinic_id, created_by, status:'active', ...prescriptionData) plus
      // the values Postgres defaults/trigger would have supplied (id,
      // prescription_number, created_at/updated_at, and NULL for absent optional
      // columns so the response shape matches a fresh Supabase row).
      const prescriptionRow = {
        id: prescriptionId,
        clinic_id: clinicId,
        patient_id: prescriptionData.patient_id,
        treatment_id: prescriptionData.treatment_id ?? null,
        prescription_number: prescriptionNumber,
        prescription_date: prescriptionData.prescription_date,
        prescriber_name: prescriptionData.prescriber_name,
        prescriber_license: prescriptionData.prescriber_license ?? null,
        prescriber_specialty: prescriptionData.prescriber_specialty ?? null,
        diagnosis: prescriptionData.diagnosis ?? null,
        status: 'active',
        valid_until: prescriptionData.valid_until ?? null,
        notes: prescriptionData.notes ?? null,
        pharmacy_notes: prescriptionData.pharmacy_notes ?? null,
        pdf_generated_at: null,
        pdf_url: null,
        created_at: nowIso,
        updated_at: nowIso,
        created_by: userId,
      }

      await upsertConvexDocumentByLegacyId('prescriptions', prescriptionId, prescriptionRow)

      // Child rows: prescription_items has its own uuid PK, an FK prescription_id,
      // and no clinic_id (scoped via the parent). Mirror the Supabase insert
      // columns + created_at default.
      const itemRows = items.map((item, index) => ({
        id: crypto.randomUUID(),
        prescription_id: prescriptionId,
        medication_id: item.medication_id ?? null,
        medication_name: item.medication_name,
        medication_strength: item.medication_strength ?? null,
        medication_form: item.medication_form ?? null,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration ?? null,
        quantity: item.quantity ?? null,
        instructions: item.instructions ?? null,
        sort_order: item.sort_order ?? index,
        created_at: nowIso,
      }))

      for (const itemRow of itemRows) {
        await upsertConvexDocumentByLegacyId('prescription_items', itemRow.id, itemRow)
      }

      // Mirror the final Supabase select shape:
      //   *, patient:patients(id, first_name, last_name, email, phone),
      //      items:prescription_items(*)
      const completePrescription = {
        ...prescriptionRow,
        patient: {
          id: patientRow.id ?? patientRow.legacyId ?? prescriptionData.patient_id,
          first_name: patientRow.first_name ?? null,
          last_name: patientRow.last_name ?? null,
          email: patientRow.email ?? null,
          phone: patientRow.phone ?? null,
        },
        items: itemRows,
      }

      return NextResponse.json({ data: completePrescription }, { status: 201 })
    }

    // Verify patient belongs to clinic
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', prescriptionData.patient_id)
      .eq('clinic_id', clinicId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Create prescription (prescription_number is auto-generated by trigger)
    const { data: prescription, error: prescriptionError } = await supabaseAdmin
      .from('prescriptions')
      .insert({
        clinic_id: clinicId,
        created_by: userId,
        status: 'active',
        ...prescriptionData,
      })
      .select()
      .single()

    if (prescriptionError) {
      console.error('[Prescriptions] Error creating:', prescriptionError)
      return NextResponse.json({ error: prescriptionError.message }, { status: 500 })
    }

    // Create prescription items
    const itemsToInsert = items.map((item, index) => ({
      prescription_id: prescription.id,
      ...item,
      sort_order: item.sort_order ?? index,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('prescription_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('[Prescriptions] Error creating items:', itemsError)
      // Rollback prescription
      await supabaseAdmin.from('prescriptions').delete().eq('id', prescription.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Fetch complete prescription with items
    const { data: completePrescription, error: fetchError } = await supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone),
        items:prescription_items(*)
      `)
      .eq('id', prescription.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: prescription }, { status: 201 })
    }

    return NextResponse.json({ data: completePrescription }, { status: 201 })
  } catch (error) {
    console.error('[Prescriptions] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
