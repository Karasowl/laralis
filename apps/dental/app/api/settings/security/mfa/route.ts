import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  loadMfaPreferences,
  saveMfaPreferences,
  type MfaPreferences,
} from '@/lib/security/mfa-preferences';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await loadMfaPreferences(supabase, user.id);
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
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await loadMfaPreferences(supabase, user.id);
    const current = preferences.two_factor ?? {};

    const updated: MfaPreferences = {
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

    await saveMfaPreferences(supabase, user.id, updated);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/security/mfa][DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to disable two-factor authentication' },
      { status: 500 },
    );
  }
}
