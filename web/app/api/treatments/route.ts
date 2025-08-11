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

    return NextResponse.json({ data: data || [] });
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

    const treatmentData = {
      clinic_id: clinicId,
      patient_id: body.patient_id,
      service_id: body.service_id,
      treatment_date: body.treatment_date || new Date().toISOString().split('T')[0],
      minutes: body.minutes || 30,
      fixed_per_minute_cents: body.fixed_per_minute_cents || 0,
      variable_cost_cents: body.variable_cost_cents || 0,
      margin_pct: body.margin_pct || 60,
      price_cents: body.price_cents || 0,
      status: body.status || 'pending',
      notes: body.notes || null,
      snapshot_costs: body.snapshot_costs || {}
    };

    const { data, error } = await supabaseAdmin
      .from('treatments')
      .insert(treatmentData)
      .select()
      .single();

    if (error) {
      console.error('Error creating treatment:', error);
      return NextResponse.json(
        { error: 'Failed to create treatment', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data,
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