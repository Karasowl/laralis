import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { generatePrescriptionPDF } from '@/lib/pdf/prescription-pdf'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
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

    const { clinicId } = clinicContext

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
