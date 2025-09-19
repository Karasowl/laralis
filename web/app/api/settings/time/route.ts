import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSettingsTime } from '@/lib/zod';
import type { SettingsTime, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { isSupabaseConfigured } from '@/lib/supabase';

type TimeSettingsRecord = SettingsTime & { clinic_id: string };

const LOCAL_STORE_KEY = '__laralisTimeSettingsStore__';

function getLocalStore() {
  const globalAny = globalThis as any;
  if (!globalAny[LOCAL_STORE_KEY]) {
    globalAny[LOCAL_STORE_KEY] = new Map<string, TimeSettingsRecord>();
  }
  return globalAny[LOCAL_STORE_KEY] as Map<string, TimeSettingsRecord>;
}

const numberOrZero = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizePayload = (body: any) => {
  const work_days = Math.round(numberOrZero(body?.work_days));
  const hours_per_day = Number(numberOrZero(body?.hours_per_day).toFixed(2));
  const rawRealPct = body?.real_pct ?? body?.real_pct_decimal ?? body?.realPct ?? 0;
  const real_pct = clamp(numberOrZero(rawRealPct), 0, 1);
  return { work_days, hours_per_day, real_pct };
};

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<SettingsTime>>> {
  try {
    const cookieStore = cookies();
    const supabaseReady = isSupabaseConfigured();
    const searchParams = request.nextUrl.searchParams;

    let clinicId = searchParams.get('clinicId') || cookieStore.get('clinicId')?.value || null;
    if (!clinicId && supabaseReady) {
      clinicId = await getClinicIdOrDefault(cookieStore);
    }

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    if (!supabaseReady) {
      const localRecord = getLocalStore().get(clinicId) || null;
      return NextResponse.json({ data: localRecord });
    }

    const { data, error } = await supabaseAdmin
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null });
      }

      console.error('Error fetching time settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch time settings', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in GET /api/settings/time:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SettingsTime>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const supabaseReady = isSupabaseConfigured();

    const cookieClinic = cookieStore.get('clinicId')?.value || null;
    const requestedClinicId = typeof body?.clinic_id === 'string' ? body.clinic_id : null;
    const clinicId = requestedClinicId || cookieClinic || (supabaseReady ? await getClinicIdOrDefault(cookieStore) : null);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const normalized = normalizePayload(body);
    const baseValidation = zSettingsTime.pick({ work_days: true, hours_per_day: true, real_pct: true }).safeParse(normalized);

    if (!baseValidation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: baseValidation.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    if (!supabaseReady) {
      const store = getLocalStore();
      const existing = store.get(clinicId);
      const now = new Date().toISOString();
      const record: TimeSettingsRecord = {
        ...baseValidation.data,
        clinic_id: clinicId,
        created_at: existing?.created_at ?? now,
        updated_at: now
      };
      store.set(clinicId, record);

      return NextResponse.json({
        data: record,
        message: existing ? 'Time settings updated' : 'Time settings created'
      });
    }

    const validationResult = zSettingsTime.safeParse({
      ...baseValidation.data,
      clinic_id: clinicId
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { work_days, hours_per_day, real_pct, clinic_id } = validationResult.data;

    const { data: existing } = await supabaseAdmin
      .from('settings_time')
      .select('id')
      .eq('clinic_id', clinic_id)
      .limit(1)
      .single();

    let result;

    if (existing) {
      result = await supabaseAdmin
        .from('settings_time')
        .update({
          work_days,
          hours_per_day,
          real_pct,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from('settings_time')
        .insert({ clinic_id, work_days, hours_per_day, real_pct })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving time settings:', result.error);
      return NextResponse.json(
        { error: 'Failed to save time settings', message: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: result.data,
      message: existing ? 'Time settings updated' : 'Time settings created'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error in POST /api/settings/time:', message, error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

// PUT method for explicit updates
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<SettingsTime>>> {
  return POST(request); // Same logic as POST for upsert
}
