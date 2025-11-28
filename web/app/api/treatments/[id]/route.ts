import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { syncTreatmentToCalendar, deleteTreatmentFromCalendar } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic'


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
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

    // En edición protegemos snapshot: no permitimos cambiar service_id salvo que se indique
    if (typeof body.service_id === 'string' && body._allow_service_change !== true) {
      delete body.service_id;
    }

    // Map UI payload to possible DB columns (parcial: solo campos presentes)
    const payload: any = { clinic_id: clinicId, updated_at: new Date().toISOString() };
    if (body.patient_id !== undefined) payload.patient_id = body.patient_id;
    if (body.service_id !== undefined) payload.service_id = body.service_id;
    if (body.treatment_date !== undefined) payload.treatment_date = body.treatment_date;
    if (body.treatment_time !== undefined) payload.treatment_time = body.treatment_time;
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

    // If treatment is completed and its date predates patient's first_visit_date, adjust it.
    try {
      const updated = result.data as any;
      const patientId = updated?.patient_id;
      const status = updated?.status;
      const clinic = clinicId;
      if (patientId && status === 'completed') {
        const { data: rows, error: earliestErr } = await supabaseAdmin
          .from('treatments')
          .select('treatment_date')
          .eq('clinic_id', clinic)
          .eq('patient_id', patientId)
          .eq('status', 'completed')
          .order('treatment_date', { ascending: true })
          .limit(1);
        if (!earliestErr && rows && rows.length > 0) {
          const earliest = rows[0].treatment_date;
          const { data: pat, error: patErr } = await supabaseAdmin
            .from('patients')
            .select('id, first_visit_date')
            .eq('clinic_id', clinic)
            .eq('id', patientId)
            .single();
          if (!patErr && pat) {
            const current = pat.first_visit_date as string | null;
            if (!current || (typeof current === 'string' && current > earliest)) {
              await supabaseAdmin
                .from('patients')
                .update({ first_visit_date: earliest })
                .eq('id', patientId)
                .eq('clinic_id', clinic);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[treatments PUT] Failed to adjust patient first_visit_date:', e);
    }

    // Sync to Google Calendar if connected
    try {
      const updated = result.data as any;
      if (updated) {
        // Fetch patient and service names for the event
        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('first_name, last_name')
          .eq('id', updated.patient_id)
          .single();
        const { data: service } = await supabaseAdmin
          .from('services')
          .select('name')
          .eq('id', updated.service_id)
          .single();

        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';
        const serviceName = service?.name || 'Treatment';
        const currentStatus = updated.status === 'scheduled' ? 'pending' : updated.status;

        const googleEventId = await syncTreatmentToCalendar(clinicId, {
          id: updated.id,
          patient_name: patientName,
          service_name: serviceName,
          treatment_date: updated.treatment_date,
          treatment_time: updated.treatment_time,
          duration_minutes: updated.duration_minutes || 30,
          status: currentStatus,
          google_event_id: updated.google_event_id,
        });

        // Update google_event_id if it changed (new event created or event deleted)
        if (googleEventId !== updated.google_event_id) {
          await supabaseAdmin
            .from('treatments')
            .update({ google_event_id: googleEventId })
            .eq('id', updated.id);
        }
      }
    } catch (e) {
      console.warn('[treatments PUT] Failed to sync to Google Calendar:', e);
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
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

    // First, get the treatment to check for google_event_id
    const { data: treatment } = await supabaseAdmin
      .from('treatments')
      .select('google_event_id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    const { error } = await supabaseAdmin
      .from('treatments')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting treatment:', error);
      return NextResponse.json({ error: 'Failed to delete treatment', message: error.message }, { status: 500 });
    }

    // Delete event from Google Calendar if it exists
    if (treatment?.google_event_id) {
      try {
        await deleteTreatmentFromCalendar(clinicId, treatment.google_event_id);
      } catch (e) {
        console.warn('[treatments DELETE] Failed to delete event from Google Calendar:', e);
      }
    }

    return NextResponse.json({ data: null, message: 'Treatment deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/treatments/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

