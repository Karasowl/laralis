import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'


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
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('locale, timezone, theme, notification_settings')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const payload = {
      ...(data ?? {}),
    };

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
      typeof payload.notification_settings === 'object' &&
      payload.notification_settings !== null
        ? {
            email:
              typeof payload.notification_settings.email === 'boolean'
                ? payload.notification_settings.email
                : true,
            sms:
              typeof payload.notification_settings.sms === 'boolean'
                ? payload.notification_settings.sms
                : false,
            push:
              typeof payload.notification_settings.push === 'boolean'
                ? payload.notification_settings.push
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
    const body = await request.json();
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
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = parseResult.data;
    const profileUpdate = {
      id: session.user.id,
      locale: payload.locale,
      timezone: payload.timezone,
      theme: payload.theme,
      notification_settings: payload.notifications,
    };

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(profileUpdate, { onConflict: 'id' });

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

