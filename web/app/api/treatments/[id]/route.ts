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

    // En edición protegemos snapshot: no permitimos cambiar service_id salvo que se indique
    if (typeof body.service_id === 'string' && body._allow_service_change !== true) {
      delete body.service_id;
    }

    // Map UI payload to possible DB columns (parcial: solo campos presentes)
    const payload: any = { clinic_id: clinicId, updated_at: new Date().toISOString() };
    if (body.patient_id !== undefined) payload.patient_id = body.patient_id;
    if (body.service_id !== undefined) payload.service_id = body.service_id;
    if (body.treatment_date !== undefined) payload.treatment_date = body.treatment_date;
    if (body.minutes !== undefined) {
      payload.duration_minutes = body.minutes;
      payload.minutes = body.minutes; // alias legacy
    }
    if (body.fixed_per_minute_cents !== undefined) {
      payload.fixed_cost_per_minute_cents = body.fixed_per_minute_cents;
      payload.fixed_per_minute_cents = body.fixed_per_minute_cents; // alias legacy
    }
    if (body.variable_cost_cents !== undefined) payload.variable_cost_cents = body.variable_cost_cents;
    if (body.margin_pct !== undefined) payload.margin_pct = body.margin_pct;
    if (body.price_cents !== undefined) payload.price_cents = body.price_cents;
    if (body.status !== undefined) payload.status = (body.status === 'pending' ? 'scheduled' : body.status);
    if (body.notes !== undefined) payload.notes = body.notes;
    if (body.snapshot_costs !== undefined) payload.snapshot_costs = body.snapshot_costs;

    // (ya incluimos alias arriba si aplica)

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

