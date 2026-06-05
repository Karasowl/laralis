import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveClinicContext } from '@/lib/clinic';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  decodeConvexValue,
} from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic';

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

// Postgres text ordering tie-break by code point (C-style), matching other routes.
function byCodePoint(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface TimeRange {
  start: string;
  end: string;
}

interface BookingConfig {
  enabled: boolean;
  allow_new_patients: boolean;
  require_phone: boolean;
  require_notes: boolean;
  max_advance_days: number;
  min_advance_hours: number;
  slot_duration_minutes: number;
  working_hours: Record<string, TimeRange | null>;
  buffer_minutes: number;
  welcome_message: string | null;
  confirmation_message: string | null;
}

const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  enabled: false,
  allow_new_patients: true,
  require_phone: true,
  require_notes: false,
  max_advance_days: 30,
  min_advance_hours: 2,
  slot_duration_minutes: 30,
  working_hours: {
    monday: { start: '09:00', end: '18:00' },
    tuesday: { start: '09:00', end: '18:00' },
    wednesday: { start: '09:00', end: '18:00' },
    thursday: { start: '09:00', end: '18:00' },
    friday: { start: '09:00', end: '18:00' },
    saturday: null,
    sunday: null,
  },
  buffer_minutes: 0,
  welcome_message: null,
  confirmation_message: null,
};

const timeRangeSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const bookingConfigSchema = z.object({
  enabled: z.boolean(),
  allow_new_patients: z.boolean().optional(),
  require_phone: z.boolean().optional(),
  require_notes: z.boolean().optional(),
  max_advance_days: z.coerce.number().int().min(1).max(365).optional(),
  min_advance_hours: z.coerce.number().int().min(0).max(168).optional(),
  slot_duration_minutes: z.coerce.number().int().min(5).max(240).optional(),
  buffer_minutes: z.coerce.number().int().min(0).max(120).optional(),
  working_hours: z.record(z.string(), timeRangeSchema.nullable()).optional(),
  welcome_message: z.string().max(500).nullable().optional(),
  confirmation_message: z.string().max(500).nullable().optional(),
});

const bookingSettingsSchema = z.object({
  slug: z.string().max(100).nullable().optional(),
  booking_config: bookingConfigSchema,
  service_ids: z.array(z.string().uuid()).optional(),
});

function normalizeSlug(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.length ? normalized : null;
}

function normalizeConfig(config?: Partial<BookingConfig> | null): BookingConfig {
  return {
    ...DEFAULT_BOOKING_CONFIG,
    ...(config || {}),
    working_hours: {
      ...DEFAULT_BOOKING_CONFIG.working_hours,
      ...(config?.working_hours || {}),
    },
  };
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'settings.view');
    if (forbidden) return forbidden;

    // Convex read branch (flag-gated, default Supabase). Auth + clinic scoping
    // already enforced (resolveClinicContext + settings.view guard). clinics is
    // keyed by id (no clinic_id column); services / public_booking_services are
    // clinic-scoped. Same column subsets + ordering as the Supabase path.
    let clinic: { id: any; name: any; slug: any; booking_config: unknown } | null;
    let services: Array<{ id: any; name: any; description: any; est_minutes: any; is_active: any }> | null;
    let selectedServices: Array<{ service_id: any; display_order: any; is_active: any }> | null;

    if (shouldReturnConvexData('clinics')) {
      const doc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as ImportedRecord | null;
      if (!doc) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }
      const c = normalizeConvexRecord(doc);
      clinic = {
        id: c.id,
        name: c.name,
        slug: c.slug,
        // booking_config is JSONB; decode nested keys to match Supabase.
        booking_config: decodeConvexValue(c.booking_config),
      };

      const svcRows = (await listConvexDocumentsByClinic('services', clinicId, 10000) as ImportedRecord[]).map(normalizeConvexRecord);
      services = svcRows
        .map((r) => ({ id: r.id, name: r.name, description: r.description, est_minutes: r.est_minutes, is_active: r.is_active }))
        .sort((a, b) => byCodePoint(String(a.name ?? ''), String(b.name ?? '')));

      const pbsRows = (await listConvexDocumentsByClinic('public_booking_services', clinicId, 10000) as ImportedRecord[]).map(normalizeConvexRecord);
      selectedServices = pbsRows
        .filter((r) => r.is_active === true)
        .map((r) => ({ service_id: r.service_id, display_order: r.display_order, is_active: r.is_active }))
        .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));
    } else {
      const clinicResult = await supabaseAdmin
        .from('clinics')
        .select('id, name, slug, booking_config')
        .eq('id', clinicId)
        .single();

      if (clinicResult.error || !clinicResult.data) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }
      clinic = clinicResult.data;

      const servicesResult = await supabaseAdmin
        .from('services')
        .select('id, name, description, est_minutes, is_active')
        .eq('clinic_id', clinicId)
        .order('name', { ascending: true });
      services = servicesResult.data;

      const selectedResult = await supabaseAdmin
        .from('public_booking_services')
        .select('service_id, display_order, is_active')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      selectedServices = selectedResult.data;
    }

    const normalizedConfig = normalizeConfig(clinic.booking_config as BookingConfig | null);
    const selectedServiceIds = (selectedServices || []).map((row) => row.service_id);

    return NextResponse.json({
      data: {
        clinic: {
          id: clinic.id,
          name: clinic.name,
          slug: clinic.slug,
        },
        booking_config: normalizedConfig,
        selected_service_ids: selectedServiceIds,
        services: services || [],
      },
    });
  } catch (error) {
    console.error('[settings/booking][GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const forbidden = await forbiddenIfMissingPermission(
      clinicContext.userId,
      clinicContext.clinicId,
      'settings.edit'
    );
    if (forbidden) return forbidden;

    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const payload = bodyResult.data;
    const parsed = bookingSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { booking_config, service_ids } = parsed.data;
    const bookingConfig = normalizeConfig(booking_config);
    const slug = normalizeSlug(parsed.data.slug);

    const updatePayload: Record<string, unknown> = {
      booking_config: bookingConfig,
    };

    if (parsed.data.slug !== undefined) {
      updatePayload.slug = slug;
    }

    const { error: updateError } = await supabaseAdmin
      .from('clinics')
      .update(updatePayload)
      .eq('id', clinicContext.clinicId);

    if (updateError) {
      console.error('[settings/booking][PUT] Failed updating clinic:', updateError);
      return NextResponse.json(
        { error: 'Failed to save booking settings' },
        { status: 500 }
      );
    }

    if (service_ids) {
      const { error: deleteError } = await supabaseAdmin
        .from('public_booking_services')
        .delete()
        .eq('clinic_id', clinicContext.clinicId);

      if (deleteError) {
        console.error('[settings/booking][PUT] Failed clearing services:', deleteError);
        return NextResponse.json(
          { error: 'Failed to update booking services' },
          { status: 500 }
        );
      }

      if (service_ids.length > 0) {
        const rows = service_ids.map((serviceId, index) => ({
          clinic_id: clinicContext.clinicId,
          service_id: serviceId,
          display_order: index,
          is_active: true,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('public_booking_services')
          .insert(rows);

        if (insertError) {
          console.error('[settings/booking][PUT] Failed saving services:', insertError);
          return NextResponse.json(
            { error: 'Failed to update booking services' },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/booking][PUT] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
