import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  loadMfaPreferences,
  saveMfaPreferences,
  ensureMfaPreferences,
  type MfaPreferences,
} from '@/lib/security/mfa-preferences';
import { listConvexTable, decodeConvexValue } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

// Convex equivalent of loadMfaPreferences: user_settings is user-scoped (no
// clinic_id) with the MFA prefs under key 'security'. The JSONB value is decoded
// (Convex stores nested object keys encoded) so the shape matches Supabase.
async function loadMfaPreferencesFromConvex(userId: string): Promise<MfaPreferences> {
  const rows = (await listConvexTable('user_settings', 10000) as ImportedRecord[]).map(normalizeConvexRecord);
  const row = rows.find((r) => String(r.user_id) === userId && r.key === 'security');
  return ensureMfaPreferences(row ? decodeConvexValue(row.value) : undefined);
}

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authError) throw authError;

    // Convex read branch (flag-gated, default Supabase). Auth already enforced by
    // supabase.auth.getUser() above; prefs are scoped to user.id only.
    const preferences = shouldReturnConvexData('user_settings')
      ? await loadMfaPreferencesFromConvex(user.id)
      : await loadMfaPreferences(supabase, user.id);
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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authError) throw authError;

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
