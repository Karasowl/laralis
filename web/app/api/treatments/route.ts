import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('treatments')
      .select(`
        *,
        patient:patients (id, first_name, last_name),
        service:services (id, name, variable_cost_cents)
      `)
      .eq('clinic_id', clinicId)
      .order('treatment_date', { ascending: false });

    if (error) {
      console.error('Error fetching treatments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch treatments', message: error.message },
        { status: 500 }
      );
    }

    const mapped = (data || []).map((row: any) => ({
      ...row,
      // Map DB column names to UI expectations (support legacy schema)
      minutes: (row.duration_minutes ?? row.minutes) ?? 0,
      fixed_per_minute_cents: (row.fixed_cost_per_minute_cents ?? row.fixed_per_minute_cents) ?? 0,
      // Map status from DB to UI ('scheduled'|'in_progress' -> 'pending')
      status: row.status === 'scheduled' || row.status === 'in_progress' ? 'pending' : row.status,
    }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error('Unexpected error in GET /api/treatments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.patient_id || !body.service_id) {
      return NextResponse.json(
        { error: 'Patient and service are required' },
        { status: 400 }
      );
    }

    // Map UI payload to DB column names and allowed values
    const treatmentData = {
      clinic_id: clinicId,
      patient_id: body.patient_id,
      service_id: body.service_id,
      treatment_date: body.treatment_date || new Date().toISOString().split('T')[0],
      duration_minutes: body.minutes || 30,
      fixed_cost_per_minute_cents: body.fixed_per_minute_cents || 0,
      variable_cost_cents: body.variable_cost_cents || 0,
      margin_pct: body.margin_pct || 60,
      price_cents: body.price_cents || 0,
      status: (body.status === 'pending' ? 'scheduled' : body.status) || 'scheduled',
      notes: body.notes || null,
      snapshot_costs: body.snapshot_costs || {}
    } as const;

    // Dynamic insert tolerant to schema variations:
    // - Start with new columns; if error says a column doesn't exist, remove it and retry.
    // - Also try legacy aliases in the initial payload to maximize success.
    let payload: any = {
      ...treatmentData,
      // Include legacy aliases; DB will ignore extra keys that don't exist after we prune
      minutes: treatmentData.duration_minutes,
      fixed_per_minute_cents: treatmentData.fixed_cost_per_minute_cents,
    };

    const triedMissing: Set<string> = new Set();
    let insertResult = await supabaseAdmin
      .from('treatments')
      .insert(payload)
      .select()
      .single();

    // Up to 4 attempts pruning missing columns reported by PostgREST
    for (let attempt = 0; attempt < 4 && insertResult.error; attempt++) {
      const message = insertResult.error.message || '';
      const match = message.match(/Could not find the '([^']+)' column/);
      if (!match) break;
      const missingCol = match[1];
      if (triedMissing.has(missingCol)) break;
      triedMissing.add(missingCol);
      delete payload[missingCol];
      insertResult = await supabaseAdmin
        .from('treatments')
        .insert(payload)
        .select()
        .single();
    }

    if (insertResult.error) {
      console.error('Error creating treatment:', insertResult.error);
      return NextResponse.json(
        { error: 'Failed to create treatment', message: insertResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: insertResult.data,
      message: 'Treatment created successfully'
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/treatments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}