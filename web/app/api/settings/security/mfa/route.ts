import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PreferencesTwoFactor {
  enabled?: boolean;
  secret?: string;
  recoveryCodes?: string[];
  verifiedAt?: string;
  disabledAt?: string | null;
}

interface PreferencesPayload {
  two_factor?: PreferencesTwoFactor;
  two_factor_pending?: {
    secret: string;
    createdAt: string;
  } | null;
  [key: string]: unknown;
}

function ensurePreferences(input: unknown): PreferencesPayload {
  if (typeof input === 'object' && input !== null) {
    return input as PreferencesPayload;
  }
  return {};
}

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const preferences = ensurePreferences(data?.preferences);
    const twoFactor = preferences.two_factor;
    const pending = preferences.two_factor_pending;

    return NextResponse.json({
      data: {
        enabled: Boolean(twoFactor?.enabled && twoFactor?.secret),
        recoveryCodesLeft: Array.isArray(twoFactor?.recoveryCodes)
          ? twoFactor!.recoveryCodes!.length
          : 0,
        hasPendingSetup: Boolean(pending?.secret),
        pendingCreatedAt: pending?.createdAt ?? null,
        lastVerifiedAt: twoFactor?.verifiedAt ?? null,
      },
    });
  } catch (error) {
    console.error('[settings/security/mfa][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load two-factor status' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const preferences = ensurePreferences(data?.preferences);
    const current = preferences.two_factor ?? {};

    const updated: PreferencesPayload = {
      ...preferences,
      two_factor: {
        ...current,
        enabled: false,
        disabledAt: new Date().toISOString(),
      },
      two_factor_pending: null,
    };

    if (updated.two_factor) {
      delete updated.two_factor.secret;
      delete updated.two_factor.recoveryCodes;
      updated.two_factor.verifiedAt = current.verifiedAt ?? null;
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ preferences: updated })
      .eq('id', session.user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/security/mfa][DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to disable two-factor authentication' },
      { status: 500 },
    );
  }
}
