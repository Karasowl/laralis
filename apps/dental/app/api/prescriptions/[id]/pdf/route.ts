import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { generatePrescriptionPDF } from '@/lib/pdf/prescription-pdf'
import { getConvexDocumentByLegacyId, listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

function isClinicRow(row: ImportedRecord | null | undefined, clinicId: string) {
  return row?.clinic_id === clinicId || row?.clinicId === clinicId
}

// clinics table is keyed by `id` (not clinic_id); verify the resolved doc matches.
function isClinicById(row: ImportedRecord | null | undefined, clinicId: string) {
  return String(row?.id ?? row?.legacyId ?? '') === String(clinicId)
}

/**
 * Reassemble the same shape Supabase returns for the PDF query:
 *   prescriptions.* +
 *   patient:patients(id, first_name, last_name, email, phone, birth_date, address) +
 *   items:prescription_items(*)
 * Returns null when the prescription is missing or not in the clinic (=> 404 parity).
 *
 * SECURITY: the Convex bridge has NO RLS. The clinic guard below is mandatory.
 * prescription_items has NO clinic_id column (it is scoped only by prescription_id FK),
 * so it MUST be read with listConvexTable + a JS filter — listByClinic would silently
 * return zero rows.
 */
async function getPrescriptionPdfDataFromConvex(id: string, clinicId: string): Promise<any> {
  const prescriptionRaw = await getConvexDocumentByLegacyId('prescriptions', id) as ImportedRecord | null
  if (!prescriptionRaw || !isClinicRow(prescriptionRaw, clinicId)) return null

  const prescription = normalizeConvexRecord(prescriptionRaw) as ImportedRecord

  // patient:patients(id, first_name, last_name, email, phone, birth_date, address)
  let patient: ImportedRecord | null = null
  if (prescription.patient_id) {
    const patients = await listConvexDocumentsByClinic('patients', clinicId, 10000) as ImportedRecord[]
    const patientRow = patients.find(
      (row) => String(row.id ?? row.legacyId ?? '') === String(prescription.patient_id)
    )
    if (patientRow) {
      patient = {
        id: patientRow.id ?? null,
        first_name: patientRow.first_name ?? null,
        last_name: patientRow.last_name ?? null,
        email: patientRow.email ?? null,
        phone: patientRow.phone ?? null,
        birth_date: patientRow.birth_date ?? null,
        address: patientRow.address ?? null,
      }
    }
  }

  // items:prescription_items(*) — child table scoped by FK (no clinic_id column)
  const allItems = await listConvexTable('prescription_items', 10000) as ImportedRecord[]
  const items = allItems
    .filter((row) => String(row.prescription_id ?? '') === String(id))
    .map((row) => normalizeConvexRecord(row)) as ImportedRecord[]

  return { ...prescription, patient, items } as ImportedRecord
}

/**
 * GET /api/prescriptions/[id]/pdf
 * Generate and download PDF for a prescription
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
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'prescriptions.print')
    if (forbidden) return forbidden

    // Flag-gated Convex read branch (byte-identical PDF output).
    // Auth-verified above (resolveClinicContext + forbiddenIfMissingPermission),
    // and getPrescriptionPdfDataFromConvex re-checks the clinic guard since the
    // Convex bridge has no RLS. Write side-effect (pdf_generated_at) is preserved.
    if (shouldReturnConvexData('prescriptions')) {
      const prescription = await getPrescriptionPdfDataFromConvex(id, clinicId)

      if (!prescription) {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
      }

      // Fetch clinic info for header
      const clinicDoc = await getConvexDocumentByLegacyId('clinics', clinicId) as ImportedRecord | null
      const clinicName = (clinicDoc && isClinicById(clinicDoc, clinicId)) ? clinicDoc.name : undefined

      // Sort items by sort_order
      if (prescription.items) {
        prescription.items.sort((a: { sort_order: number }, b: { sort_order: number }) =>
          a.sort_order - b.sort_order
        )
      }

      // Generate PDF
      const pdfBuffer = await generatePrescriptionPDF(
        prescription,
        clinicName || 'Clínica Dental'
      )

      // Update prescription to mark PDF as generated (write side-effect preserved)
      await supabaseAdmin
        .from('prescriptions')
        .update({ pdf_generated_at: new Date().toISOString() })
        .eq('id', id)

      // Return PDF
      const filename = `receta-${prescription.prescription_number}.pdf`

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      })
    }

    // Fetch prescription with all related data
    const { data: prescription, error: prescriptionError } = await supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone, birth_date, address),
        items:prescription_items(*)
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (prescriptionError || !prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
    }

    // Fetch clinic info for header
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single()

    // Sort items by sort_order
    if (prescription.items) {
      prescription.items.sort((a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order
      )
    }

    // Generate PDF
    const pdfBuffer = await generatePrescriptionPDF(
      prescription,
      clinic?.name || 'Clínica Dental'
    )

    // Update prescription to mark PDF as generated
    await supabaseAdmin
      .from('prescriptions')
      .update({ pdf_generated_at: new Date().toISOString() })
      .eq('id', id)

    // Return PDF
    const filename = `receta-${prescription.prescription_number}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[Prescription PDF] Error generating:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
