import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { syncTreatmentToCalendar } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic'


const treatmentSchema = z.object({
  clinic_id: z.string().optional(),
  patient_id: z.string().min(1, 'Patient is required'),
  service_id: z.string().min(1, 'Service is required'),
  treatment_date: z.string().optional(),
  treatment_time: z.string().optional(), // HH:MM format for appointment time
  minutes: z.coerce.number().int().positive('Minutes must be positive').optional(),
  duration_minutes: z.coerce.number().int().positive('Minutes must be positive').optional(),
  fixed_per_minute_cents: z.coerce.number().int().nonnegative().optional(),
  fixed_cost_per_minute_cents: z.coerce.number().int().nonnegative().optional(),
  variable_cost_cents: z.coerce.number().int().nonnegative().optional(),
  margin_pct: z.coerce.number().min(0).optional(), // No upper limit - in-house services can have very high margins
  price_cents: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'scheduled', 'in_progress']).optional(),
  notes: z.string().optional(),
  snapshot_costs: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

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
    const rawBody = await request.json();
    const parsed = treatmentSchema.safeParse(rawBody);
    if (!parsed.success) {
      const message = parsed.error.errors.map(err => err.message).join(', ');
      return NextResponse.json(
        {
          error: 'Validation failed',
          message,
        },
        { status: 400 }
      );
    }
    const payloadBody = parsed.data;
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: rawBody?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

    // Validate required fields
    if (!payloadBody.patient_id || !payloadBody.service_id) {
      return NextResponse.json(
        { error: 'Patient and service are required' },
        { status: 400 }
      );
    }

    // Server-side preconditions: block creation if financial base not ready
    let calculatedCostPerMinute = 0;
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
      const calculatedCostPerMinute = effectiveMinutes > 0 && totalFixed > 0 ? Math.round(totalFixed / effectiveMinutes) : 0;
      if (calculatedCostPerMinute <= 0) {
        return NextResponse.json({ error: 'precondition_failed', message: 'Cost per minute is not configured. Complete time and fixed costs.' }, { status: 412 });
      }

      // 2) Service must have a recipe (or at least variable cost derivable)
      const serviceId = payloadBody.service_id;
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
    const minutesVal = Number(
      (payloadBody.duration_minutes ?? payloadBody.minutes) || 0
    );
    const priceVal = Number(payloadBody.price_cents ?? 0);
    const marginVal = Number(payloadBody.margin_pct ?? 60);
    if (!minutesVal || minutesVal <= 0) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Minutes must be greater than zero.' }, { status: 412 });
    }
    if (marginVal < 0) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Margin percentage must be non-negative.' }, { status: 412 });
    }
    // If status is completed, require a positive price snapshot
    const normalizedStatus = (() => {
      const status = payloadBody.status;
      if (!status) return 'scheduled';
      return status === 'pending' ? 'scheduled' : status;
    })();
    if (normalizedStatus === 'completed' && (!priceVal || priceVal <= 0)) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Tariff/price is required to complete a treatment.' }, { status: 412 });
    }

    // Map UI payload to DB column names and allowed values
    const treatmentData = {
      clinic_id: clinicId,
      patient_id: payloadBody.patient_id,
      service_id: payloadBody.service_id,
      treatment_date: payloadBody.treatment_date || new Date().toISOString().split('T')[0],
      treatment_time: payloadBody.treatment_time || null, // HH:MM format for appointment scheduling
      duration_minutes: minutesVal || 30,
      fixed_cost_per_minute_cents:
        payloadBody.fixed_cost_per_minute_cents ?? payloadBody.fixed_per_minute_cents ?? calculatedCostPerMinute,
      variable_cost_cents: payloadBody.variable_cost_cents ?? 0,
      margin_pct: marginVal || 60,
      price_cents: priceVal || 0,
      status: normalizedStatus,
      notes: payloadBody.notes?.trim() ? payloadBody.notes.trim() : null,
      snapshot_costs: payloadBody.snapshot_costs || {}
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

    // Sync to Google Calendar if connected (for pending/scheduled treatments)
    try {
      const created = insertResult.data as any;
      if (created && (created.status === 'scheduled' || created.status === 'pending')) {
        // Fetch patient and service names for the event
        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('first_name, last_name')
          .eq('id', created.patient_id)
          .single();
        const { data: service } = await supabaseAdmin
          .from('services')
          .select('name')
          .eq('id', created.service_id)
          .single();

        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';
        const serviceName = service?.name || 'Treatment';

        const googleEventId = await syncTreatmentToCalendar(clinicId, {
          id: created.id,
          patient_name: patientName,
          service_name: serviceName,
          treatment_date: created.treatment_date,
          treatment_time: created.treatment_time,
          duration_minutes: created.duration_minutes || 30,
          status: created.status === 'scheduled' ? 'pending' : created.status,
          google_event_id: null,
        });

        // Save google_event_id if sync was successful
        if (googleEventId) {
          await supabaseAdmin
            .from('treatments')
            .update({ google_event_id: googleEventId })
            .eq('id', created.id);
        }
      }
    } catch (e) {
      console.warn('[treatments POST] Failed to sync to Google Calendar:', e);
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
