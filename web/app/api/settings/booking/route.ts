import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveClinicContext } from '@/lib/clinic';

export const dynamic = 'force-dynamic';

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

    const { clinicId } = clinicContext;

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, name, slug, booking_config')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
    }

    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, name, description, est_minutes, is_active')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true });

    const { data: selectedServices } = await supabaseAdmin
      .from('public_booking_services')
      .select('service_id, display_order, is_active')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

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

    const payload = await request.json();
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
