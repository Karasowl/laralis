import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

interface RouteParams {
  params: { id: string };
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });
    }

    // Map UI payload to possible DB columns
    let payload: any = {
      clinic_id: clinicId,
      patient_id: body.patient_id,
      service_id: body.service_id,
      treatment_date: body.treatment_date,
      duration_minutes: body.minutes,
      fixed_cost_per_minute_cents: body.fixed_per_minute_cents,
      variable_cost_cents: body.variable_cost_cents,
      margin_pct: body.margin_pct,
      price_cents: body.price_cents,
      status: body.status === 'pending' ? 'scheduled' : body.status,
      notes: body.notes,
      snapshot_costs: body.snapshot_costs,
      updated_at: new Date().toISOString()
    };

    // Include legacy aliases so we can prune based on errors
    payload.minutes = body.minutes;
    payload.fixed_per_minute_cents = body.fixed_per_minute_cents;

    // Attempt update; if a column doesn't exist, remove and retry up to 4 times
    const triedMissing: Set<string> = new Set();
    let result = await supabaseAdmin
      .from('treatments')
      .update(payload)
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    for (let attempt = 0; attempt < 4 && result.error; attempt++) {
      const msg = result.error.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/);
      if (!match) break;
      const missing = match[1];
      if (triedMissing.has(missing)) break;
      triedMissing.add(missing);
      delete (payload as any)[missing];
      result = await supabaseAdmin
        .from('treatments')
        .update(payload)
        .eq('id', params.id)
        .eq('clinic_id', clinicId)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error updating treatment:', result.error);
      return NextResponse.json({ error: 'Failed to update treatment', message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data, message: 'Treatment updated successfully' });
  } catch (error) {
    console.error('Unexpected error in PUT /api/treatments/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic context available' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('treatments')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting treatment:', error);
      return NextResponse.json({ error: 'Failed to delete treatment', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: null, message: 'Treatment deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/treatments/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

