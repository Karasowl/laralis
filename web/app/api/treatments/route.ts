import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();

    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const patientId = searchParams.get('patient_id') || searchParams.get('patient');

    let query = supabaseAdmin
      .from('treatments')
      .select(`
        *,
        patient:patients (id, first_name, last_name),
        service:services (id, name, variable_cost_cents)
      `)
      .eq('clinic_id', clinicId)
      .order('treatment_date', { ascending: false }) as any;

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    const { data, error } = await query;

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
      status: (row.status === 'scheduled' || row.status === 'in_progress') ? 'pending' : (row.status || 'pending'),
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

    // Server-side preconditions: block creation if financial base not ready
    try {
      // 1) Cost per minute must be derivable and > 0
      const { data: timeRow } = await supabaseAdmin
        .from('settings_time')
        .select('work_days, hours_per_day, real_pct')
        .eq('clinic_id', clinicId)
        .single();
      const { data: fixedList } = await supabaseAdmin
        .from('fixed_costs')
        .select('amount_cents')
        .eq('clinic_id', clinicId);
      const { data: assetsList } = await supabaseAdmin
        .from('assets')
        .select('purchase_price_cents, depreciation_months')
        .eq('clinic_id', clinicId);
      const fixedSum = (fixedList || []).reduce((s, r) => s + (r.amount_cents || 0), 0);
      const dep = (assetsList || []).reduce((s, a) => s + (a.depreciation_months ? Math.round(a.purchase_price_cents / a.depreciation_months) : 0), 0);
      const totalFixed = fixedSum + dep;
      const wd = Number(timeRow?.work_days || 0);
      const hpd = Number(timeRow?.hours_per_day || 0);
      const rp = Number(timeRow?.real_pct || 0);
      const rpDec = rp > 1 ? rp / 100 : rp; // tolerate decimal or percent
      const minutesMonth = wd * hpd * 60;
      const effectiveMinutes = Math.round(minutesMonth * Math.max(0, Math.min(1, rpDec)));
      const cpm = effectiveMinutes > 0 && totalFixed > 0 ? Math.round(totalFixed / effectiveMinutes) : 0;
      if (cpm <= 0) {
        return NextResponse.json({ error: 'precondition_failed', message: 'Cost per minute is not configured. Complete time and fixed costs.' }, { status: 412 });
      }

      // 2) Service must have a recipe (or at least variable cost derivable)
      const serviceId = body.service_id;
      if (!serviceId) {
        return NextResponse.json({ error: 'validation_error', message: 'Service is required' }, { status: 400 });
      }
      const { count: recipeCount } = await supabaseAdmin
        .from('service_supplies')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId);
      if (!recipeCount || recipeCount <= 0) {
        return NextResponse.json({ error: 'precondition_failed', message: 'Service has no recipe. Define supplies for the service.' }, { status: 412 });
      }
    } catch (e) {
      // If any check fails unexpectedly, do not mask as 500; surface as precondition
      return NextResponse.json({ error: 'precondition_failed', message: 'Unable to verify prerequisites for treatment creation.' }, { status: 412 });
    }

    // Validate pricing snapshot presence
    const minutesVal = Number(body.minutes || 0);
    const priceVal = Number(body.price_cents || 0);
    const marginVal = Number(body.margin_pct ?? 60);
    if (!minutesVal || minutesVal <= 0) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Minutes must be greater than zero.' }, { status: 412 });
    }
    if (marginVal < 0 || marginVal > 100) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Margin percentage must be between 0 and 100.' }, { status: 412 });
    }
    // If status is completed, require a positive price snapshot
    const normalizedStatus = (body.status === 'pending' ? 'scheduled' : body.status) || 'scheduled';
    if (normalizedStatus === 'completed' && (!priceVal || priceVal <= 0)) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Tariff/price is required to complete a treatment.' }, { status: 412 });
    }

    // Map UI payload to DB column names and allowed values
    const treatmentData = {
      clinic_id: clinicId,
      patient_id: body.patient_id,
      service_id: body.service_id,
      treatment_date: body.treatment_date || new Date().toISOString().split('T')[0],
      duration_minutes: minutesVal || 30,
      fixed_cost_per_minute_cents: body.fixed_per_minute_cents || 0,
      variable_cost_cents: body.variable_cost_cents || 0,
      margin_pct: marginVal || 60,
      price_cents: priceVal || 0,
      status: normalizedStatus,
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

    // After creating a treatment, if it's completed and earlier than the patient's recorded first visit,
    // adjust the patient's first_visit_date to the earliest completed treatment date.
    try {
      const created = insertResult.data as any;
      const patientId = created?.patient_id;
      const status = created?.status;
      if (patientId && status === 'completed') {
        // Fetch earliest completed treatment date for this patient in this clinic
        const { data: rows, error: earliestErr } = await supabaseAdmin
          .from('treatments')
          .select('treatment_date')
          .eq('clinic_id', clinicId)
          .eq('patient_id', patientId)
          .eq('status', 'completed')
          .order('treatment_date', { ascending: true })
          .limit(1);
        if (!earliestErr && rows && rows.length > 0) {
          const earliest = rows[0].treatment_date;
          // Get current patient first_visit_date
          const { data: pat, error: patErr } = await supabaseAdmin
            .from('patients')
            .select('id, first_visit_date')
            .eq('clinic_id', clinicId)
            .eq('id', patientId)
            .single();
          if (!patErr && pat) {
            const current = pat.first_visit_date as string | null;
            if (!current || (typeof current === 'string' && current > earliest)) {
              await supabaseAdmin
                .from('patients')
                .update({ first_visit_date: earliest })
                .eq('id', patientId)
                .eq('clinic_id', clinicId);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[treatments POST] Failed to adjust patient first_visit_date:', e);
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
