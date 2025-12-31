import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

const paymentSchema = z.object({
  amount_cents: z.coerce.number().int().positive('Amount must be positive'),
});

/**
 * POST /api/treatments/[id]/payment
 * Register a partial or full payment for a treatment
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.errors.map(err => err.message).join(', ');
      return NextResponse.json(
        { error: 'Validation failed', message },
        { status: 400 }
      );
    }

    const { amount_cents } = parsed.data;
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId } = clinicContext;

    // Get current treatment
    const { data: treatment, error: fetchError } = await supabaseAdmin
      .from('treatments')
      .select('id, price_cents, amount_paid_cents, status, is_paid')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (fetchError || !treatment) {
      return NextResponse.json(
        { error: 'Treatment not found' },
        { status: 404 }
      );
    }

    // Calculate new amount paid
    const currentPaid = treatment.amount_paid_cents || 0;
    const newPaid = currentPaid + amount_cents;
    const balance = (treatment.price_cents || 0) - newPaid;

    // Validate payment doesn't exceed price
    if (newPaid > (treatment.price_cents || 0)) {
      return NextResponse.json(
        {
          error: 'Payment exceeds balance',
          message: `Maximum payment allowed: ${(treatment.price_cents || 0) - currentPaid} cents`,
          max_payment_cents: (treatment.price_cents || 0) - currentPaid
        },
        { status: 400 }
      );
    }

    // Update treatment with new payment amount
    // Note: is_paid is calculated by trigger in DB
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('treatments')
      .update({
        amount_paid_cents: newPaid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select('id, price_cents, amount_paid_cents, is_paid, status')
      .single();

    if (updateError) {
      console.error('Error registering payment:', updateError);
      return NextResponse.json(
        { error: 'Failed to register payment', message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        ...updated,
        balance_cents: (updated.price_cents || 0) - (updated.amount_paid_cents || 0),
        payment_registered_cents: amount_cents,
      },
      message: updated.is_paid ? 'Payment completed - fully paid' : 'Payment registered successfully',
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/treatments/[id]/payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
