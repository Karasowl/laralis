import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSettingsTime } from '@/lib/zod';
import type { SettingsTime, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { isSupabaseConfigured } from '@/lib/supabase';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { listConvexDocumentsByClinic, upsertConvexDocumentByLegacyId, patchConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'


type TimeSettingsRecord = SettingsTime & { clinic_id: string; created_at?: string; updated_at?: string };

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

const missingColumnFromSupabaseError = (error: { message?: string } | null | undefined) => {
  const match = error?.message?.match(/Could not find the '([^']+)' column/);
  return match?.[1] || null;
};

const normalizePayload = (body: any) => {
  const work_days = Math.round(numberOrZero(body?.work_days));
  const hours_per_day = Number(numberOrZero(body?.hours_per_day).toFixed(2));
  const rawRealPct = body?.real_pct ?? body?.real_pct_decimal ?? body?.realPct ?? 0;
  const real_pct = clamp(numberOrZero(rawRealPct), 0, 100);
  const working_days_config = body?.working_days_config || null;

  // Handle monthly_goal_cents (optional field)
  let monthly_goal_cents: number | null = null;
  if (body?.monthly_goal_cents !== undefined && body?.monthly_goal_cents !== null) {
    const goalValue = numberOrZero(body.monthly_goal_cents);
    monthly_goal_cents = goalValue > 0 ? Math.round(goalValue) : null;
  }

  return { work_days, hours_per_day, real_pct, working_days_config, monthly_goal_cents };
};

type ImportedRecord = Record<string, any>;

function normalizeTimeSettingsRecord(row: ImportedRecord | null | undefined): SettingsTime | null {
  if (!row) return null;
  const rawRealPct = row.real_hours_percentage ?? row.real_pct ?? 0;
  const normalizedRealPct = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct;

  return {
    id: row.id,
    clinic_id: row.clinic_id,
    work_days: row.working_days_per_month ?? row.work_days,
    hours_per_day: row.hours_per_day,
    real_pct: normalizedRealPct,
    monthly_goal_cents: row.monthly_goal_cents ?? null,
    updated_at: row.updated_at,
  };
}

async function getTimeSettingsFromConvex(clinicId: string) {
  const rows = await listConvexDocumentsByClinic('settings_time', clinicId, 10) as ImportedRecord[];
  const sortedRows = rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  return normalizeTimeSettingsRecord(sortedRows[0]);
}

async function saveTimeSettingsToConvex(
  clinicId: string,
  normalized: ReturnType<typeof normalizePayload>,
  existingId?: string | null
) {
  const now = new Date().toISOString();
  const id = existingId || crypto.randomUUID();
  const dbRealPct = normalized.real_pct / 100;
  const row = {
    id,
    clinic_id: clinicId,
    work_days: normalized.work_days,
    working_days_per_month: normalized.work_days,
    hours_per_day: normalized.hours_per_day,
    real_pct: dbRealPct,
    real_hours_percentage: dbRealPct,
    working_days_config: normalized.working_days_config,
    monthly_goal_cents: normalized.monthly_goal_cents ?? null,
    updated_at: now,
    ...(existingId ? {} : { created_at: now }),
  };

  if (existingId) {
    await patchConvexDocumentByLegacyId('settings_time', existingId, row);
  } else {
    await upsertConvexDocumentByLegacyId('settings_time', id, row);
  }

  return normalizeTimeSettingsRecord(row);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = cookies();
    const supabaseReady = isSupabaseConfigured();
    const searchParams = request.nextUrl.searchParams;

    let clinicId: string | null = null;
    if (supabaseReady) {
      const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
      if ('error' in ctx) {
        return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
      }
      const forbidden = await forbiddenIfMissingPermission(ctx.userId, ctx.clinicId, 'settings.view');
      if (forbidden) return forbidden;
      clinicId = ctx.clinicId;
    } else {
      clinicId = searchParams.get('clinicId') || cookieStore.get('clinicId')?.value || null;
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

    if (shouldReturnConvexData('settings_time')) {
      const data = await getTimeSettingsFromConvex(clinicId);
      return NextResponse.json({ data });
    }

    const { data: dbData, error } = await supabaseAdmin
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

    // Transform DB field names to TypeScript field names
    // Handle both possible DB schemas (old and new)
    if (dbData) {
      const rawRealPct = dbData.real_hours_percentage ?? dbData.real_pct ?? 0;
      // Normalize: DB stores as decimal (0-1), TypeScript expects percentage (0-100)
      const normalizedRealPct = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct;

      const data: SettingsTime = {
        id: dbData.id,
        clinic_id: dbData.clinic_id,
        work_days: dbData.working_days_per_month ?? dbData.work_days,
        hours_per_day: dbData.hours_per_day,
        real_pct: normalizedRealPct,
        monthly_goal_cents: dbData.monthly_goal_cents ?? null,
        updated_at: dbData.updated_at,
      };

      return NextResponse.json({ data });
    }

    return NextResponse.json({ data: null });
  } catch (error) {
    console.error('Unexpected error in GET /api/settings/time:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data as Record<string, any>;
    const cookieStore = cookies();
    const supabaseReady = isSupabaseConfigured();

    let clinicId: string | null = null;
    if (supabaseReady) {
      const ctx = await resolveClinicContext({ requestedClinicId: typeof body?.clinic_id === 'string' ? body.clinic_id : null, cookieStore });
      if ('error' in ctx) {
        return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
      }
      const forbidden = await forbiddenIfMissingPermission(ctx.userId, ctx.clinicId, 'settings.edit');
      if (forbidden) return forbidden;
      clinicId = ctx.clinicId;
    } else {
      const cookieClinic = cookieStore.get('clinicId')?.value || null;
      clinicId = (typeof body?.clinic_id === 'string' ? body.clinic_id : null) || cookieClinic;
    }

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

    if (shouldUseConvexOnlyWritePath('settings_time')) {
      const existing = await getTimeSettingsFromConvex(clinicId);
      const data = await saveTimeSettingsToConvex(clinicId, normalized, existing?.id ?? null);

      return NextResponse.json({
        data,
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

    const { work_days, hours_per_day, real_pct, clinic_id, monthly_goal_cents } = validationResult.data;
    const working_days_config = normalized.working_days_config;

    // Normalize: TypeScript uses percentage (0-100), DB expects decimal (0-1)
    const dbRealPct = real_pct / 100;

    // Include both field name formats to support different DB schemas
    const dbPayload: Record<string, unknown> = {
      work_days: work_days,                           // Short names (current schema)
      working_days_per_month: work_days,              // Long names (migration schema)
      hours_per_day: hours_per_day,
      real_pct: dbRealPct,                            // Short names - as decimal
      real_hours_percentage: dbRealPct,               // Long names - as decimal
      working_days_config,
      monthly_goal_cents: monthly_goal_cents ?? null, // Optional goal field
    };

    const { data: existing } = await supabaseAdmin
      .from('settings_time')
      .select('id')
      .eq('clinic_id', clinic_id)
      .limit(1)
      .single();

    let result;

    const savePayload = async (payload: Record<string, unknown>) => {
      if (existing) {
        return supabaseAdmin
          .from('settings_time')
          .update({
            ...payload,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
      }

      return supabaseAdmin
        .from('settings_time')
        .insert({
          clinic_id,
          ...payload
        })
        .select()
        .single();
    };

    let attemptedPayload = { ...dbPayload };
    result = await savePayload(attemptedPayload);

    for (let attempts = 0; result.error && attempts < 5; attempts += 1) {
      const missingColumn = missingColumnFromSupabaseError(result.error);
      if (!missingColumn || !(missingColumn in attemptedPayload)) break;

      const { [missingColumn]: _removed, ...nextPayload } = attemptedPayload;
      attemptedPayload = nextPayload;
      result = await savePayload(attemptedPayload);
    }

    if (result.error) {
      console.error('Error saving time settings:', result.error);
      return NextResponse.json(
        { error: 'Failed to save time settings', message: result.error.message },
        { status: 500 }
      );
    }

    // Transform DB field names back to TypeScript field names for response
    // Handle both possible DB schemas (old and new)
    const rawRealPct = result.data.real_hours_percentage ?? result.data.real_pct ?? 0;
    // Normalize: DB stores as decimal (0-1), TypeScript expects percentage (0-100)
    const normalizedRealPct = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct;

    const transformedData: SettingsTime = {
      id: result.data.id,
      clinic_id: result.data.clinic_id,
      work_days: result.data.working_days_per_month ?? result.data.work_days,
      hours_per_day: result.data.hours_per_day,
      real_pct: normalizedRealPct,
      monthly_goal_cents: result.data.monthly_goal_cents ?? null,
      updated_at: result.data.updated_at,
    };

    if (result.data && shouldWriteConvexData('settings_time')) {
      try {
        await saveTimeSettingsToConvex(clinicId, normalized, result.data.id);
      } catch (convexError) {
        console.error('[settings/time POST] Convex dual-write failed:', convexError);
      }
    }

    return NextResponse.json({
      data: transformedData,
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
export async function PUT(request: NextRequest): Promise<NextResponse> {
  return POST(request); // Same logic as POST for upsert
}
