import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { readJson } from '@/lib/validation';
import { listConvexTable, decodeConvexValue } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}


const preferencesSchema = z.object({
  locale: z.string().min(2).max(10),
  timezone: z.string().min(2).max(80),
  theme: z.enum(['light', 'dark', 'system']),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
  }),
});

type PreferencesPayload = z.infer<typeof preferencesSchema>;

function defaultPreferences(): PreferencesPayload {
  return {
    locale: 'es',
    timezone: 'America/Mexico_City',
    theme: 'system',
    notifications: {
      email: true,
      sms: false,
      push: false,
    },
  };
}

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Convex read branch (flag-gated, default Supabase). Auth already enforced by
    // supabase.auth.getUser() above; user_settings is scoped to user.id (no clinic_id).
    let data: { value: unknown } | null = null;
    if (shouldReturnConvexData('user_settings')) {
      const rows = (await listConvexTable('user_settings', 10000) as ImportedRecord[]).map(normalizeConvexRecord);
      const row = rows.find((r) => String(r.user_id) === user.id && r.key === 'preferences');
      // value is JSONB; decode nested keys to mirror the Supabase row shape.
      data = row ? { value: decodeConvexValue(row.value) } : null;
    } else {
      const result = await supabase
        .from('user_settings')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', 'preferences')
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }
      data = result.data;
    }

    const payload = {
      ...(typeof data?.value === 'object' && data.value !== null ? data.value : {}),
    } as Partial<PreferencesPayload>;

    const locale = typeof payload.locale === 'string' ? payload.locale : 'es';
    const timezone =
      typeof payload.timezone === 'string'
        ? payload.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const theme =
      payload.theme === 'dark' || payload.theme === 'light'
        ? payload.theme
        : 'system';
    const notifications =
      typeof payload.notifications === 'object' &&
      payload.notifications !== null
        ? {
            email:
              typeof payload.notifications.email === 'boolean'
                ? payload.notifications.email
                : true,
            sms:
              typeof payload.notifications.sms === 'boolean'
                ? payload.notifications.sms
                : false,
            push:
              typeof payload.notifications.push === 'boolean'
                ? payload.notifications.push
                : false,
          }
        : defaultPreferences().notifications;

    return NextResponse.json({
      data: {
        locale,
        timezone,
        theme,
        notifications,
      },
    });
  } catch (error) {
    console.error('[settings/preferences][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load preferences' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    const parseResult = preferencesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = parseResult.data;

    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          key: 'preferences',
          value: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' }
      );

    if (upsertError) {
      throw upsertError;
    }

    // Sync preferred language to auth metadata for faster access on login
    try {
      await supabase.auth.updateUser({
        data: {
          preferred_language: payload.locale,
        },
      });
    } catch (syncError) {
      console.warn('[settings/preferences] Failed to sync preferred language', syncError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/preferences][PUT]', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 },
    );
  }
}

