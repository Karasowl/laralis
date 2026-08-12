import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { syncTreatmentToCalendar, CalendarSyncResult } from '@/lib/google-calendar';
import {
  sendConfirmationEmail,
  AppointmentEmailData,
  isConfirmationEnabled,
} from '@/lib/email/service';
import {
  sendAllTreatmentCreatedNotifications,
  TreatmentNotificationParams,
} from '@/lib/sms/service';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { checkScheduleConflicts } from '@/lib/calendar/server-conflicts';
import { getPushNotificationServiceForRequest } from '@/lib/notifications/qa';
import { listConvexDocumentsByClinic, listConvexTable, upsertConvexDocumentByLegacyId, patchConvexDocumentByLegacyId, getConvexDocumentByLegacyId, getConvexTreatmentsPage } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';
import { deriveTreatmentPaymentState } from '@/lib/calc/treatment-payment';
import { createTreatmentListPage, type TreatmentListFilters } from '@/convex/treatmentList';

export const dynamic = 'force-dynamic'


const treatmentSchema = z.object({
  clinic_id: z.string().optional(),
  patient_id: z.string().min(1, 'Patient is required'),
  service_id: z.string().min(1, 'Service is required'),
  treatment_date: z.string().optional(),
  treatment_time: z.string().optional(), // HH:MM format for appointment time
  quantity: z.coerce.number().int().min(1).max(100).optional(),
  multiplier: z.coerce.number().int().min(1).max(100).optional(),
  minutes: z.coerce.number().int().positive('Minutes must be positive').optional(),
  duration_minutes: z.coerce.number().int().positive('Minutes must be positive').optional(),
  fixed_per_minute_cents: z.coerce.number().int().nonnegative().optional(),
  fixed_cost_per_minute_cents: z.coerce.number().int().nonnegative().optional(),
  variable_cost_cents: z.coerce.number().int().nonnegative().optional(),
  margin_pct: z.coerce.number().min(0).optional(), // No upper limit - in-house services can have very high margins
  price_cents: z.coerce.number().int().nonnegative().optional(),
  amount_paid_cents: z.coerce.number().int().nonnegative().optional(), // Partial payments
  pending_balance_cents: z.coerce.number().int().nonnegative().nullable().optional(), // Explicit pending balance (user-marked)
  status: z.enum(['pending', 'completed', 'cancelled', 'scheduled', 'in_progress']).optional(),
  notes: z.string().optional(),
  snapshot_costs: z.record(z.any()).optional(),
});

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id));
      return ids.map((id) => [id, row] as const);
    })
  );
}

function optionalNumber(value: string | null) {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function csvValues(value: string | null) {
  if (!value) return undefined;
  const values = value.split(',').map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function calculateFixedCostPerMinute(
  timeSettings: ImportedRecord | null | undefined,
  fixedCosts: ImportedRecord[],
  assets: ImportedRecord[]
) {
  const fixedSum = fixedCosts.reduce((sum, row) => sum + (Number(row.amount_cents) || 0), 0);
  const depreciation = assets.reduce((sum, asset) => {
    const months = Number(asset.depreciation_months) || 1;
    return sum + Math.round((Number(asset.purchase_price_cents) || 0) / months);
  }, 0);
  const workDays = Number(timeSettings?.work_days || 0);
  const hoursPerDay = Number(timeSettings?.hours_per_day || 0);
  const rawRealPct = Number(timeSettings?.real_pct || 0);
  const realPct = rawRealPct > 1 ? rawRealPct / 100 : rawRealPct;
  const effectiveMinutes = Math.round(workDays * hoursPerDay * 60 * Math.max(0, Math.min(1, realPct)));
  const totalFixed = fixedSum + depreciation;
  return effectiveMinutes > 0 && totalFixed > 0 ? Math.round(totalFixed / effectiveMinutes) : 0;
}

async function getTreatmentsFromConvex(
  clinicId: string,
  filters: {
    patientId?: string | null
    hasBalance?: boolean
    dateFrom?: string | null
    dateTo?: string | null
  }
) {
  const [treatments, patients, services] = await Promise.all([
    listConvexDocumentsByClinic('treatments', clinicId, 2000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 1000) as Promise<ImportedRecord[]>,
  ]);
  const patientsById = byId(patients);
  const servicesById = byId(services);

  return treatments
    .filter((row) => {
      if (filters.patientId && row.patient_id !== filters.patientId) return false;
      if (filters.hasBalance && Number(row.pending_balance_cents || 0) <= 0) return false;
      if (filters.dateFrom && String(row.treatment_date || '') < filters.dateFrom) return false;
      if (filters.dateTo && String(row.treatment_date || '') > filters.dateTo) return false;
      return true;
    })
    .sort((a, b) => String(b.treatment_date || '').localeCompare(String(a.treatment_date || '')))
    .map((row) => {
      const patient = row.patient_id ? patientsById.get(String(row.patient_id)) : null;
      const service = row.service_id ? servicesById.get(String(row.service_id)) : null;
      return {
        ...normalizeConvexRecord(row),
        patient: patient
          ? {
              id: patient.id,
              first_name: patient.first_name,
              last_name: patient.last_name,
            }
          : null,
        service: service
          ? {
              id: service.id,
              name: service.name,
              variable_cost_cents: service.variable_cost_cents,
            }
          : null,
        minutes: (row.duration_minutes ?? row.minutes) ?? 0,
        fixed_per_minute_cents: (row.fixed_cost_per_minute_cents ?? row.fixed_per_minute_cents) ?? 0,
        amount_paid_cents: row.amount_paid_cents ?? 0,
        is_paid: row.is_paid ?? false,
        status: (row.status === 'scheduled' || row.status === 'in_progress') ? 'pending' : (row.status || 'pending'),
      };
    });
}

/**
 * Convex port of create_treatment_reminder() (migration 61). For each newly created
 * scheduled treatment whose date is today or later, insert a scheduled_reminders row
 * based on the clinic's notification_settings (reminder_enabled / reminder_hours_before).
 * Best-effort: a failure logs and never fails treatment creation. Fresh treatment ids
 * mean no ON CONFLICT (treatment_id, reminder_type) collision on the create path.
 */
async function scheduleConvexTreatmentReminders(
  createdRows: Array<Record<string, any>>,
  clinicId: string,
  now: string
): Promise<void> {
  try {
    const todayStr = now.slice(0, 10);
    const scheduledRows = createdRows.filter(
      (r) => r.status === 'scheduled' && String(r.treatment_date).slice(0, 10) >= todayStr
    );
    if (scheduledRows.length === 0) return;

    const clinic = (await getConvexDocumentByLegacyId('clinics', clinicId)) as Record<string, any> | null;
    const settings = (clinic?.notification_settings ?? null) as Record<string, any> | null;
    if (!settings || settings.reminder_enabled !== true) return;

    // COALESCE(reminder_hours_before, 24): only NULL/undefined defaults to 24, an
    // explicit 0 stays 0 (reminder at treatment time). `Number(x) || 24` would wrongly
    // turn 0 into 24.
    const rawReminderHours = settings.reminder_hours_before;
    const reminderHours =
      rawReminderHours != null && !Number.isNaN(Number(rawReminderHours))
        ? Number(rawReminderHours)
        : 24;
    const reminderType =
      reminderHours === 24 ? '24h' : reminderHours === 48 ? '48h' : reminderHours === 1 ? '1h' : 'custom';
    const nowMs = new Date(now).getTime();

    for (const r of scheduledRows) {
      const time = r.treatment_time || '12:00:00';
      const treatmentDateTime = new Date(`${String(r.treatment_date).slice(0, 10)}T${time}`);
      const reminderDateTime = new Date(treatmentDateTime.getTime() - reminderHours * 3600 * 1000);
      if (reminderDateTime.getTime() <= nowMs) continue;
      const id = crypto.randomUUID();
      await upsertConvexDocumentByLegacyId('scheduled_reminders', id, {
        id,
        clinic_id: clinicId,
        treatment_id: r.id,
        patient_id: r.patient_id,
        scheduled_for: reminderDateTime.toISOString(),
        reminder_type: reminderType,
        status: 'pending',
        created_at: now,
      });
    }
  } catch (error) {
    console.warn('[treatments] convex reminder scheduling failed', { clinicId, error });
  }
}

async function createTreatmentsInConvex(
  clinicId: string,
  payloadBody: z.infer<typeof treatmentSchema>,
  treatmentCount: number,
  normalizedStatus: string,
  minutesVal: number,
  priceVal: number,
  amountPaidVal: number,
  pendingBalanceVal: number,
  marginVal: number
) {
  const [
    timeRows,
    fixedCosts,
    assets,
    serviceSupplies,
    existingTreatments,
    patients,
    services,
  ] = await Promise.all([
    listConvexDocumentsByClinic('settings_time', clinicId, 10) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('fixed_costs', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('assets', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexTable('service_supplies', 5000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 2000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 1000) as Promise<ImportedRecord[]>,
  ]);

  const calculatedCostPerMinute = calculateFixedCostPerMinute(timeRows[0], fixedCosts, assets);
  if (calculatedCostPerMinute <= 0) {
    return NextResponse.json({ error: 'precondition_failed', message: 'Cost per minute is not configured. Complete time and fixed costs.' }, { status: 412 });
  }

  const serviceRecipeCount = serviceSupplies.filter((row) => row.service_id === payloadBody.service_id).length;
  if (serviceRecipeCount <= 0) {
    return NextResponse.json({ error: 'precondition_failed', message: 'Service has no recipe. Define supplies for the service.' }, { status: 412 });
  }

  if (
    payloadBody.treatment_time &&
    ['scheduled', 'in_progress'].includes(normalizedStatus)
  ) {
    if (treatmentCount > 1) {
      return NextResponse.json(
        {
          error: 'appointment_conflict',
          message: 'Multiple scheduled appointments cannot share the same time slot.',
          conflicts: [],
        },
        { status: 409 }
      );
    }

    const conflict = existingTreatments.find((row) => {
      return (
        row.treatment_date === (payloadBody.treatment_date || new Date().toISOString().split('T')[0]) &&
        row.treatment_time === payloadBody.treatment_time &&
        ['scheduled', 'in_progress'].includes(row.status)
      );
    });
    if (conflict) {
      return NextResponse.json(
        {
          error: 'appointment_conflict',
          message: 'The selected appointment time conflicts with an existing appointment or public booking request.',
          conflicts: [normalizeConvexRecord(conflict)],
        },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const treatmentDate = payloadBody.treatment_date || new Date().toISOString().split('T')[0];
  // Reproduce the calculate_treatment_is_paid trigger (migration 73): clamp pending >= 0,
  // is_paid = pending==0 OR status=='cancelled'. In Supabase mode the DB trigger fills
  // is_paid; in convex-only mode we must stamp it or completed+paid treatments read unpaid.
  const { pendingBalanceCents: clampedPending, isPaid } = deriveTreatmentPaymentState({
    pendingBalanceCents: pendingBalanceVal,
    status: normalizedStatus,
  });
  const basePayload = {
    clinic_id: clinicId,
    patient_id: payloadBody.patient_id,
    service_id: payloadBody.service_id,
    treatment_date: treatmentDate,
    treatment_time: payloadBody.treatment_time || null,
    duration_minutes: minutesVal || 30,
    fixed_cost_per_minute_cents: calculatedCostPerMinute,
    variable_cost_cents: payloadBody.variable_cost_cents ?? 0,
    margin_pct: marginVal || 60,
    price_cents: priceVal || 0,
    amount_paid_cents: amountPaidVal,
    pending_balance_cents: clampedPending,
    is_paid: isPaid,
    status: normalizedStatus,
    notes: payloadBody.notes?.trim() ? payloadBody.notes.trim() : null,
    snapshot_costs: payloadBody.snapshot_costs || {},
    minutes: minutesVal || 30,
    fixed_per_minute_cents: calculatedCostPerMinute,
    created_at: now,
    updated_at: now,
  };

  const createdRows = [];
  for (let index = 0; index < treatmentCount; index++) {
    const id = crypto.randomUUID();
    const row = {
      ...basePayload,
      id,
    };
    await upsertConvexDocumentByLegacyId('treatments', id, row);
    createdRows.push(row);
  }

  // Reproduce create_treatment_reminder() (trigger, migration 61): schedule a
  // reminder row for each future scheduled treatment per the clinic's notification
  // settings. In Supabase mode the DB trigger does this; the inline confirmation
  // email/SMS/push is separate.
  await scheduleConvexTreatmentReminders(createdRows, clinicId, now);

  if (normalizedStatus === 'completed') {
    const patient = patients.find((row) => row.id === payloadBody.patient_id || row.legacyId === payloadBody.patient_id);
    const current = patient?.first_visit_date as string | null | undefined;
    if (patient && (!current || current > treatmentDate)) {
      await patchConvexDocumentByLegacyId('patients', String(patient.id || patient.legacyId), {
        first_visit_date: treatmentDate,
        updated_at: now,
      });
    }
  }

  const patientsById = byId(patients);
  const servicesById = byId(services);
  const mappedRows = createdRows.map((row) => {
    const patient = patientsById.get(row.patient_id);
    const service = servicesById.get(row.service_id);
    return {
      ...row,
      patient: patient ? { id: patient.id, first_name: patient.first_name, last_name: patient.last_name } : null,
      service: service ? { id: service.id, name: service.name, variable_cost_cents: service.variable_cost_cents } : null,
    };
  });

  return NextResponse.json({
    data: mappedRows.length === 1 ? mappedRows[0] : mappedRows,
    created_count: mappedRows.length,
    message: mappedRows.length === 1 ? 'Treatment created successfully' : `${mappedRows.length} treatments created successfully`,
    calendarSync: undefined,
    emailSent: false,
    smsSent: false,
    pushSent: false,
  });
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.view');
    if (forbidden) return forbidden;

    const patientId = searchParams.get('patient_id') || searchParams.get('patient');
    const hasBalance = searchParams.get('has_balance') === 'true';
    const dateFrom = searchParams.get('start_date') || searchParams.get('date_from') || searchParams.get('from');
    const dateTo = searchParams.get('end_date') || searchParams.get('date_to') || searchParams.get('to');
    const paginated = searchParams.get('paginated') === 'true';
    const page = Math.max(0, Math.floor(optionalNumber(searchParams.get('page')) ?? 0));
    const pageSize = Math.max(1, Math.min(100, Math.floor(optionalNumber(searchParams.get('page_size')) ?? 50)));
    const requestedType = searchParams.get('type_filter');
    const typeFilter = requestedType === 'appointments' || requestedType === 'treatments'
      ? requestedType
      : 'all';
    const listFilters: TreatmentListFilters = {
      patientId: patientId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      statuses: csvValues(searchParams.get('statuses')),
      serviceIds: csvValues(searchParams.get('service_ids')),
      patientIds: csvValues(searchParams.get('patient_ids')),
      priceFrom: optionalNumber(searchParams.get('price_from')),
      priceTo: optionalNumber(searchParams.get('price_to')),
      hasBalance,
      typeFilter,
      today: searchParams.get('today') || new Date().toISOString().slice(0, 10),
      search: searchParams.get('search') || undefined,
    };

    if (shouldReturnConvexData('treatments')) {
      if (paginated) {
        const result = await getConvexTreatmentsPage({
          clinicId,
          page,
          pageSize,
          ...listFilters,
        }) as any;
        return NextResponse.json({
          ...result,
          data: (result?.data || []).map(normalizeConvexRecord),
        });
      }

      const data = await getTreatmentsFromConvex(clinicId, {
        patientId,
        hasBalance,
        dateFrom,
        dateTo,
      });
      return NextResponse.json({ data });
    }

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

    if (dateFrom && !paginated) {
      query = query.gte('treatment_date', dateFrom);
    }

    if (dateTo && !paginated) {
      query = query.lte('treatment_date', dateTo);
    }

    // Filter treatments with explicit pending balance (user-marked)
    if (hasBalance && !paginated) {
      query = query.gt('pending_balance_cents', 0);
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
      // Ensure payment fields are present
      amount_paid_cents: row.amount_paid_cents ?? 0,
      is_paid: row.is_paid ?? false,
      // Map status from DB to UI ('scheduled'|'in_progress' -> 'pending')
      status: (row.status === 'scheduled' || row.status === 'in_progress') ? 'pending' : (row.status || 'pending'),
    }));

    if (paginated) {
      return NextResponse.json(createTreatmentListPage({
        rows: mapped,
        filters: listFilters,
        page,
        pageSize,
      }));
    }

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
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const rawBody = bodyResult.data as Record<string, any>;
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
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.create');
    if (forbidden) return forbidden;

    // Validate required fields
    if (!payloadBody.patient_id || !payloadBody.service_id) {
      return NextResponse.json(
        { error: 'Patient and service are required' },
        { status: 400 }
      );
    }

    const minutesVal = Number(
      (payloadBody.duration_minutes ?? payloadBody.minutes) || 0
    );
    const priceVal = Number(payloadBody.price_cents ?? 0);
    const marginVal = Number(payloadBody.margin_pct ?? 60);
    const normalizedStatus = (() => {
      const status = payloadBody.status;
      if (!status) return 'scheduled';
      return status === 'pending' ? 'scheduled' : status;
    })();
    const amountPaidVal = Number(payloadBody.amount_paid_cents ?? 0);
    const pendingBalanceVal = payloadBody.pending_balance_cents ?? Math.max(0, (priceVal || 0) - amountPaidVal);
    const quantityRaw = payloadBody.quantity ?? payloadBody.multiplier ?? 1;
    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: 'validation_error', message: 'quantity must be between 1 and 100.' }, { status: 400 });
    }
    const treatmentCount = Math.floor(quantity);

    if (!minutesVal || minutesVal <= 0) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Minutes must be greater than zero.' }, { status: 412 });
    }
    if (marginVal < 0) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Margin percentage must be non-negative.' }, { status: 412 });
    }
    if (normalizedStatus === 'completed' && (!priceVal || priceVal <= 0)) {
      return NextResponse.json({ error: 'precondition_failed', message: 'Tariff/price is required to complete a treatment.' }, { status: 412 });
    }

    if (shouldUseConvexOnlyWritePath('treatments')) {
      return createTreatmentsInConvex(
        clinicId,
        payloadBody,
        treatmentCount,
        normalizedStatus,
        minutesVal,
        priceVal,
        amountPaidVal,
        pendingBalanceVal,
        marginVal
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
      // Assign to outer variable (not const, to avoid shadowing)
      calculatedCostPerMinute = effectiveMinutes > 0 && totalFixed > 0 ? Math.round(totalFixed / effectiveMinutes) : 0;
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

    // Map UI payload to DB column names and allowed values
    const treatmentData = {
      clinic_id: clinicId,
      patient_id: payloadBody.patient_id,
      service_id: payloadBody.service_id,
      treatment_date: payloadBody.treatment_date || new Date().toISOString().split('T')[0],
      treatment_time: payloadBody.treatment_time || null, // HH:MM format for appointment scheduling
      duration_minutes: minutesVal || 30,
      // ALWAYS use server-calculated value, ignore frontend (which may send 0)
      fixed_cost_per_minute_cents: calculatedCostPerMinute,
      variable_cost_cents: payloadBody.variable_cost_cents ?? 0,
      margin_pct: marginVal || 60,
      price_cents: priceVal || 0,
      amount_paid_cents: amountPaidVal, // Partial payments support
      pending_balance_cents: pendingBalanceVal,
      status: normalizedStatus,
      notes: payloadBody.notes?.trim() ? payloadBody.notes.trim() : null,
      snapshot_costs: payloadBody.snapshot_costs || {}
    } as const;

    if (
      treatmentData.treatment_time &&
      ['scheduled', 'in_progress'].includes(normalizedStatus)
    ) {
      if (treatmentCount > 1) {
        return NextResponse.json(
          {
            error: 'appointment_conflict',
            message: 'Multiple scheduled appointments cannot share the same time slot.',
            conflicts: [],
          },
          { status: 409 }
        );
      }

      const conflictResult = await checkScheduleConflicts({
        clinicId,
        date: treatmentData.treatment_date,
        time: treatmentData.treatment_time,
        durationMinutes: treatmentData.duration_minutes,
      });

      if (conflictResult.hasConflict) {
        return NextResponse.json(
          {
            error: 'appointment_conflict',
            message: 'The selected appointment time conflicts with an existing appointment or public booking request.',
            conflicts: conflictResult.conflicts,
          },
          { status: 409 }
        );
      }
    }

    // Dynamic insert tolerant to schema variations:
    // - Start with new columns; if error says a column doesn't exist, remove it and retry.
    // - Also try legacy aliases in the initial payload to maximize success.
    const basePayload: any = {
      ...treatmentData,
      // Include legacy aliases; DB will ignore extra keys that don't exist after we prune
      minutes: treatmentData.duration_minutes,
      fixed_per_minute_cents: treatmentData.fixed_cost_per_minute_cents,
    };
    let payloadRows: any[] = Array.from({ length: treatmentCount }, () => ({ ...basePayload }));

    const triedMissing: Set<string> = new Set();
    let insertResult = await supabaseAdmin
      .from('treatments')
      .insert(payloadRows)
      .select();

    // Up to 4 attempts pruning missing columns reported by PostgREST
    for (let attempt = 0; attempt < 4 && insertResult.error; attempt++) {
      const message = insertResult.error.message || '';
      const match = message.match(/Could not find the '([^']+)' column/);
      if (!match) break;
      const missingCol = match[1];
      if (triedMissing.has(missingCol)) break;
      triedMissing.add(missingCol);
      payloadRows = payloadRows.map((row) => {
        const cloned = { ...row };
        delete cloned[missingCol];
        return cloned;
      });
      insertResult = await supabaseAdmin
        .from('treatments')
        .insert(payloadRows)
        .select();
    }

    if (insertResult.error) {
      console.error('Error creating treatment:', insertResult.error);
      return NextResponse.json(
        { error: 'Failed to create treatment', message: insertResult.error.message },
        { status: 500 }
      );
    }
    const createdRows = (insertResult.data || []) as any[];
    const created = createdRows[0] || null;
    if (!created) {
      return NextResponse.json({ error: 'Failed to create treatment', message: 'No treatment rows were created.' }, { status: 500 });
    }

    // After creating a treatment, if it's completed and earlier than the patient's recorded first visit,
    // adjust the patient's first_visit_date to the earliest completed treatment date.
    try {
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

    const shouldDispatchCreationSideEffects = treatmentCount === 1;

    // Sync to Google Calendar if connected (for syncable statuses: pending/scheduled/in_progress)
    let calendarSync: CalendarSyncResult | null = null;
    try {
      const syncableStatuses = ['scheduled', 'pending', 'in_progress'];
      if (shouldDispatchCreationSideEffects && created && syncableStatuses.includes(created.status)) {
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

        calendarSync = await syncTreatmentToCalendar(clinicId, {
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
        if (calendarSync.success && calendarSync.eventId) {
          await supabaseAdmin
            .from('treatments')
            .update({ google_event_id: calendarSync.eventId })
            .eq('id', created.id);
          created.google_event_id = calendarSync.eventId;
        }
      }
    } catch (e) {
      console.warn('[treatments POST] Failed to sync to Google Calendar:', e);
      calendarSync = {
        success: false,
        error: { code: 'api_error', message: e instanceof Error ? e.message : 'Unexpected error' }
      };
    }

    // Send confirmation email (non-blocking, best-effort)
    let emailSent = false;
    try {
      const syncableStatuses = ['scheduled', 'pending', 'in_progress'];
      if (shouldDispatchCreationSideEffects && created && syncableStatuses.includes(created.status)) {
        // Fetch clinic notification settings
        const { data: clinic } = await supabaseAdmin
          .from('clinics')
          .select('name, phone, address, notification_settings')
          .eq('id', clinicId)
          .single();

        if (clinic && isConfirmationEnabled(clinic.notification_settings)) {
          // Fetch patient email
          const { data: patient } = await supabaseAdmin
            .from('patients')
            .select('first_name, last_name, email')
            .eq('id', created.patient_id)
            .single();

          // Fetch service info
          const { data: service } = await supabaseAdmin
            .from('services')
            .select('name, est_minutes')
            .eq('id', created.service_id)
            .single();

          if (patient?.email && service) {
            const emailData: AppointmentEmailData = {
              patientName: `${patient.first_name} ${patient.last_name}`,
              patientEmail: patient.email,
              clinicName: clinic.name,
              clinicPhone: clinic.phone || undefined,
              clinicAddress: clinic.address || undefined,
              serviceName: service.name,
              appointmentDate: created.treatment_date,
              appointmentTime: created.treatment_time || undefined,
              duration: service.est_minutes || created.duration_minutes || 30,
              notes: created.notes || undefined,
            };

            const emailResult = await sendConfirmationEmail(emailData);

            if (emailResult.success) {
              emailSent = true;
              // Log the notification
              await supabaseAdmin.from('email_notifications').insert({
                clinic_id: clinicId,
                treatment_id: created.id,
                patient_id: created.patient_id,
                notification_type: 'confirmation',
                recipient_email: patient.email,
                recipient_name: `${patient.first_name} ${patient.last_name}`,
                subject: `Cita Confirmada - ${service.name}`,
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_message_id: emailResult.messageId || null,
              });
            } else {
              // Log failed attempt
              await supabaseAdmin.from('email_notifications').insert({
                clinic_id: clinicId,
                treatment_id: created.id,
                patient_id: created.patient_id,
                notification_type: 'confirmation',
                recipient_email: patient.email,
                recipient_name: `${patient.first_name} ${patient.last_name}`,
                subject: `Cita Confirmada - ${service.name}`,
                status: 'failed',
                error_message: emailResult.error || 'Unknown error',
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[treatments POST] Failed to send confirmation email:', e);
    }

    // Send SMS notifications (non-blocking, best-effort)
    let smsSent = false;
    try {
      const syncableStatuses = ['scheduled', 'pending', 'in_progress'];
      if (shouldDispatchCreationSideEffects && created && syncableStatuses.includes(created.status)) {
        // Fetch clinic info
        const { data: clinic } = await supabaseAdmin
          .from('clinics')
          .select('name')
          .eq('id', clinicId)
          .single();

        // Fetch patient info (need phone)
        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('first_name, last_name, phone')
          .eq('id', created.patient_id)
          .single();

        // Fetch service info
        const { data: service } = await supabaseAdmin
          .from('services')
          .select('name')
          .eq('id', created.service_id)
          .single();

        if (clinic && patient?.phone && service) {
          const smsParams: TreatmentNotificationParams = {
            clinicId,
            clinicName: clinic.name,
            patientName: `${patient.first_name} ${patient.last_name}`,
            patientPhone: patient.phone,
            patientId: created.patient_id,
            treatmentId: created.id,
            serviceName: service.name,
            appointmentDate: created.treatment_date,
            appointmentTime: created.treatment_time || '12:00',
          };

          const smsResults = await sendAllTreatmentCreatedNotifications(smsParams);
          smsSent = smsResults.patient.success || smsResults.staff.primary.success;

          if (smsResults.patient.success) {
            console.info(`[treatments POST] SMS sent to patient for treatment ${created.id}`);
          }
          if (smsResults.staff.primary.success) {
            console.info(`[treatments POST] SMS sent to staff for treatment ${created.id}`);
          }
        }
      }
    } catch (e) {
      console.warn('[treatments POST] Failed to send SMS notifications:', e);
    }

    // Send staff/browser push notification (non-blocking, best-effort)
    let pushSent = false;
    let pushSummary: { attempted: number; sent: number; failed: number; skipped: number } | undefined;
    try {
      if (shouldDispatchCreationSideEffects && created) {
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

        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Paciente';
        const serviceName = service?.name || 'Tratamiento';
        const summary = await getPushNotificationServiceForRequest(request).sendNotificationToClinic({
          clinicId,
          notificationType: 'treatment_created',
          payload: {
            title: 'Nuevo tratamiento',
            body: `${serviceName} para ${patientName}`,
            icon: '/icons/icon-192x192.png',
            url: '/treatments',
            tag: `treatment-created-${created.id}`,
          },
        });

        pushSent = summary.sent > 0;
        pushSummary = {
          attempted: summary.attempted,
          sent: summary.sent,
          failed: summary.failed,
          skipped: summary.skipped,
        };
      }
    } catch (e) {
      console.warn('[treatments POST] Failed to send push notifications:', e);
    }

    if (shouldWriteConvexData('treatments')) {
      for (const row of createdRows) {
        if (row?.id) {
          try {
            await upsertConvexDocumentByLegacyId('treatments', row.id, row);
          } catch (convexError) {
            console.error('[treatments POST] Convex dual-write failed:', convexError);
          }
        }
      }
    }

    const createdCount = createdRows.length;
    return NextResponse.json({
      data: createdCount === 1 ? created : createdRows,
      created_count: createdCount,
      message: createdCount === 1 ? 'Treatment created successfully' : `${createdCount} treatments created successfully`,
      calendarSync: calendarSync || undefined,
      emailSent,
      smsSent,
      pushSent,
      pushSummary,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/treatments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
