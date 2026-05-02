import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { deleteTreatmentFromCalendar } from '@/lib/google-calendar';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic'

const refundSchema = z.object({
  clinic_id: z.string().uuid().optional(),
  refund_reason: z.string().trim().min(1),
});

interface RouteParams {
  params: { id: string };
}

/**
 * PATCH /api/treatments/[id]/refund
 *
 * Marks a treatment as refunded. This is irreversible.
 *
 * Financial impact:
 * - Revenue from this treatment becomes $0 (money returned to patient)
 * - Costs are STILL incurred:
 *   - Variable costs (materials already used)
 *   - Fixed costs (professional time already spent)
 * - Total loss = variable_cost_cents + (fixed_cost_per_minute_cents * minutes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(refundSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body = parsed.data;
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;
    const { refund_reason } = body;

    // First, fetch the treatment to verify it exists and check its current state
    const { data: treatment, error: fetchError } = await supabaseAdmin
      .from('treatments')
      .select('id, status, is_refunded, google_event_id, patient_id, service_id, variable_cost_cents, duration_minutes, fixed_cost_per_minute_cents, price_cents')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (fetchError || !treatment) {
      return NextResponse.json({
        error: 'Treatment not found',
        code: 'NOT_FOUND'
      }, { status: 404 });
    }

    // Check if already refunded
    if (treatment.is_refunded) {
      return NextResponse.json({
        error: 'This treatment has already been refunded',
        code: 'ALREADY_REFUNDED'
      }, { status: 400 });
    }

    // Check if cancelled (cannot refund cancelled treatments)
    if (treatment.status === 'cancelled') {
      return NextResponse.json({
        error: 'Cannot refund a cancelled treatment',
        code: 'CANNOT_REFUND_CANCELLED'
      }, { status: 400 });
    }

    // Update the treatment to mark it as refunded
    const refundedAt = new Date().toISOString();
    const { data: updatedTreatment, error: updateError } = await supabaseAdmin
      .from('treatments')
      .update({
        is_refunded: true,
        refunded_at: refundedAt,
        refund_reason: refund_reason.trim(),
        updated_at: refundedAt
      })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (updateError) {
      console.error('Error refunding treatment:', updateError);
      return NextResponse.json({
        error: 'Failed to process refund',
        message: updateError.message
      }, { status: 500 });
    }

    // Delete from Google Calendar if connected (since treatment is now refunded)
    if (treatment.google_event_id) {
      try {
        await deleteTreatmentFromCalendar(clinicId, treatment.google_event_id);
        // Clear the google_event_id
        await supabaseAdmin
          .from('treatments')
          .update({ google_event_id: null })
          .eq('id', params.id);
      } catch (e) {
        console.warn('[treatments refund] Failed to delete event from Google Calendar:', e);
        // Don't fail the refund if calendar deletion fails
      }
    }

    // Calculate the loss for this refund for the response
    const variableCost = treatment.variable_cost_cents || 0;
    const fixedCostPerMinute = treatment.fixed_cost_per_minute_cents || 0;
    const minutes = treatment.duration_minutes || 0;
    const fixedCost = fixedCostPerMinute * minutes;
    const totalLoss = variableCost + fixedCost;

    return NextResponse.json({
      data: updatedTreatment,
      message: 'Treatment refunded successfully',
      refundDetails: {
        refunded_at: refundedAt,
        variable_cost_loss: variableCost,
        fixed_cost_loss: fixedCost,
        total_loss: totalLoss,
        original_price: treatment.price_cents
      }
    });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/treatments/[id]/refund:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
