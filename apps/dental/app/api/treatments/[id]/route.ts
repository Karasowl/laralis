import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { syncTreatmentToCalendar, deleteTreatmentFromCalendar, CalendarSyncResult } from '@/lib/google-calendar';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { getConvexDocumentByLegacyId, listConvexDocumentsByClinic, listConvexTable, patchConvexDocumentByLegacyId, deleteConvexDocumentByLegacyId } from '@/lib/convex/server';
import { deriveTreatmentPaymentState } from '@/lib/calc/treatment-payment';
import { shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

const treatmentUpdateSchema = z.object({
  clinic_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  treatment_date: z.string().min(1).optional(),
  treatment_time: z.string().optional(),
  minutes: z.coerce.number().int().positive().optional(),
  fixed_per_minute_cents: z.coerce.number().int().nonnegative().optional(),
  variable_cost_cents: z.coerce.number().int().nonnegative().optional(),
  margin_pct: z.coerce.number().nonnegative().optional(),
  price_cents: z.coerce.number().int().nonnegative().optional(),
  amount_paid_cents: z.coerce.number().int().nonnegative().optional(),
  pending_balance_cents: z.coerce.number().int().nonnegative().optional(),
  status: z.string().min(1).optional(),
  notes: z.string().optional(),
  snapshot_costs: z.unknown().optional(),
  _allow_service_change: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'No fields to update',
});

interface RouteParams {
  params: { id: string };
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(treatmentUpdateSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body = parsed.data;
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.edit');
    if (forbidden) return forbidden;

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
    if (body.amount_paid_cents !== undefined) payload.amount_paid_cents = body.amount_paid_cents;
    if (body.pending_balance_cents !== undefined) payload.pending_balance_cents = body.pending_balance_cents;
    if (body.status !== undefined) payload.status = (body.status === 'pending' ? 'scheduled' : body.status);
    if (body.notes !== undefined) payload.notes = body.notes;
    if (body.snapshot_costs !== undefined) payload.snapshot_costs = body.snapshot_costs;

    // (ya incluimos alias arriba si aplica)

    if (shouldUseConvexOnlyWritePath('treatments')) {
      const current = await getConvexDocumentByLegacyId('treatments', params.id) as Record<string, any> | null
      if (!current || current.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Treatment not found' }, { status: 404 })
      }

      // Reproduce trigger 73 (calculate_treatment_is_paid), which also fires on UPDATE:
      // re-derive is_paid + clamp pending from the effective status/pending when either
      // changed (Supabase mode gets this from the DB trigger).
      if (payload.status !== undefined || payload.pending_balance_cents !== undefined) {
        const effectiveStatus = payload.status !== undefined ? payload.status : current.status
        const effectivePending = payload.pending_balance_cents !== undefined
          ? payload.pending_balance_cents
          : current.pending_balance_cents
        const { pendingBalanceCents, isPaid } = deriveTreatmentPaymentState({
          pendingBalanceCents: effectivePending,
          status: effectiveStatus,
        })
        payload.pending_balance_cents = pendingBalanceCents
        payload.is_paid = isPaid
      }

      await patchConvexDocumentByLegacyId('treatments', params.id, payload)
      const updated = {
        ...current,
        ...payload,
      }

      // Reproduce cancel_treatment_reminder (trigger 61): when the status becomes
      // terminal, cancel this treatment's pending reminders.
      if (
        payload.status !== undefined &&
        ['completed', 'cancelled', 'no_show'].includes(String(payload.status)) &&
        String(current.status) === 'scheduled'
      ) {
        try {
          const reminders = await listConvexDocumentsByClinic('scheduled_reminders', clinicId) as Array<Record<string, any>>
          const nowIso = new Date().toISOString()
          for (const reminder of reminders) {
            if (String(reminder.treatment_id) === String(params.id) && reminder.status === 'pending') {
              await patchConvexDocumentByLegacyId('scheduled_reminders', String(reminder.id ?? reminder.legacyId), {
                status: 'cancelled',
                processed_at: nowIso,
                updated_at: nowIso,
              })
            }
          }
        } catch (e) {
          console.warn('[treatments PUT] Failed to cancel Convex reminders:', e)
        }
      }

      if (updated.patient_id && updated.status === 'completed') {
        try {
          const treatments = await listConvexDocumentsByClinic('treatments', clinicId)
          const completedDates = treatments
            .filter((row: any) => row.patient_id === updated.patient_id && row.status === 'completed' && row.treatment_date)
            .map((row: any) => String(row.treatment_date))
            .sort()
          const earliest = completedDates[0]
          if (earliest) {
            const patient = await getConvexDocumentByLegacyId('patients', updated.patient_id) as Record<string, any> | null
            if (patient && (!patient.first_visit_date || String(patient.first_visit_date) > earliest)) {
              await patchConvexDocumentByLegacyId('patients', updated.patient_id, {
                first_visit_date: earliest,
                updated_at: new Date().toISOString(),
              })
            }
          }
        } catch (e) {
          console.warn('[treatments PUT] Failed to adjust Convex patient first_visit_date:', e)
        }
      }

      return NextResponse.json({
        data: updated,
        message: 'Treatment updated successfully',
      })
    }

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

    if (result.data && shouldWriteConvexData('treatments')) {
      try {
        await patchConvexDocumentByLegacyId('treatments', params.id, result.data as Record<string, unknown>)
      } catch (convexError) {
        console.error('[treatments PUT] Convex mirror failed:', convexError)
      }
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

    // Update scheduled reminders if date/time changed
    if (body.treatment_date !== undefined || body.treatment_time !== undefined) {
      try {
        const updated = result.data as any;
        const newDate = updated.treatment_date;
        const newTime = updated.treatment_time || '12:00:00';
        const appointmentDateTime = new Date(`${newDate}T${newTime}`);

        // Get pending reminders for this treatment
        const { data: pendingReminders } = await supabaseAdmin
          .from('scheduled_reminders')
          .select('id, reminder_type')
          .eq('treatment_id', params.id)
          .eq('clinic_id', clinicId)
          .eq('status', 'pending');

        if (pendingReminders && pendingReminders.length > 0) {
          for (const reminder of pendingReminders) {
            let hoursOffset = 24; // default for reminder_24h
            if (reminder.reminder_type === 'reminder_2h') {
              hoursOffset = 2;
            }

            const newScheduledFor = new Date(appointmentDateTime.getTime() - hoursOffset * 60 * 60 * 1000);

            await supabaseAdmin
              .from('scheduled_reminders')
              .update({ scheduled_for: newScheduledFor.toISOString() })
              .eq('id', reminder.id);
          }
          console.info(`[treatments PUT] Updated ${pendingReminders.length} scheduled reminders for treatment ${params.id}`);
        }
      } catch (e) {
        console.warn('[treatments PUT] Failed to update scheduled reminders:', e);
      }
    }

    // Sync to Google Calendar if connected
    let calendarSync: CalendarSyncResult | null = null;
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

        calendarSync = await syncTreatmentToCalendar(clinicId, {
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
        const newEventId = calendarSync.success ? calendarSync.eventId : null;
        if (newEventId !== updated.google_event_id) {
          await supabaseAdmin
            .from('treatments')
            .update({ google_event_id: newEventId })
            .eq('id', updated.id);
        }
      }
    } catch (e) {
      console.warn('[treatments PUT] Failed to sync to Google Calendar:', e);
      calendarSync = {
        success: false,
        error: { code: 'api_error', message: e instanceof Error ? e.message : 'Unexpected error' }
      };
    }

    return NextResponse.json({
      data: result.data,
      message: 'Treatment updated successfully',
      calendarSync: calendarSync || undefined
    });
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
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.delete');
    if (forbidden) return forbidden;

    if (shouldUseConvexOnlyWritePath('treatments')) {
      const treatment = await getConvexDocumentByLegacyId('treatments', params.id) as Record<string, any> | null
      if (!treatment || treatment.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Treatment not found' }, { status: 404 })
      }

      try {
        const reminders = await listConvexTable('scheduled_reminders').catch(() => [])
        await Promise.all(
          reminders
            .filter((row: any) => row.treatment_id === params.id && row.clinic_id === clinicId)
            .map((row: any) => {
              const rowId = String(row.id || row.legacyId || '')
              return rowId ? deleteConvexDocumentByLegacyId('scheduled_reminders', rowId) : Promise.resolve()
            })
        )
      } catch (e) {
        console.warn('[treatments DELETE] Failed to delete Convex reminders:', e)
      }

      await deleteConvexDocumentByLegacyId('treatments', params.id)

      return NextResponse.json({ data: null, message: 'Treatment deleted successfully' })
    }

    // First, get the treatment to check for google_event_id
    const { data: treatment } = await supabaseAdmin
      .from('treatments')
      .select('google_event_id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    // Delete scheduled reminders for this treatment
    const { error: reminderError } = await supabaseAdmin
      .from('scheduled_reminders')
      .delete()
      .eq('treatment_id', params.id)
      .eq('clinic_id', clinicId);

    if (reminderError) {
      console.warn('[treatments DELETE] Failed to delete scheduled reminders:', reminderError);
      // Continue with treatment deletion even if reminder deletion fails
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

    if (shouldWriteConvexData('treatments')) {
      try {
        await deleteConvexDocumentByLegacyId('treatments', params.id)
      } catch (convexError) {
        console.error('[treatments DELETE] Convex mirror failed:', convexError)
      }
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

