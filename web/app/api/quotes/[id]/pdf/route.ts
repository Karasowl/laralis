import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { generateQuotePDF } from '@/lib/pdf/quote-pdf'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/quotes/[id]/pdf
 * Generate and return a PDF for a quote
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

    // Fetch quote with patient and items
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select(`
        *,
        patient:patients(id, first_name, last_name, email, phone, address, city),
        items:quote_items(*, service:services(id, name, description, est_minutes))
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Fetch clinic info for the PDF header
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('name, address, phone, email')
      .eq('id', clinicId)
      .single()

    // Sort items by sort_order
    if (quote.items) {
      quote.items.sort((a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order
      )
    }

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(
      quote,
      clinic?.name || 'Clínica Dental',
      clinic?.address,
      clinic?.phone,
      clinic?.email
    )

    // Update pdf_generated_at timestamp
    await supabaseAdmin
      .from('quotes')
      .update({ pdf_generated_at: new Date().toISOString() })
      .eq('id', id)

    // Return PDF with appropriate headers
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="presupuesto-${quote.quote_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[Quotes PDF] Error generating:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
