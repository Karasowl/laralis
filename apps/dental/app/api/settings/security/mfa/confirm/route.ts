import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  verifyTotpToken,
} from '@/lib/security/totp';
import { loadMfaPreferences, saveMfaPreferences } from '@/lib/security/mfa-preferences';
import { readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  code: z.string().min(6).max(10),
});

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

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
    const pending = preferences.two_factor_pending;

    if (!pending?.secret) {
      return NextResponse.json(
        { error: 'No pending two-factor setup found' },
        { status: 400 },
      );
    }

    const secret = decryptSecret(pending.secret);
    const isValid = verifyTotpToken(secret, parsed.data.code);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 },
      );
    }

    const { plain, hashed } = generateRecoveryCodes();
    const encryptedSecret = encryptSecret(secret);

    const updatedPreferences = {
      ...preferences,
      two_factor: {
        enabled: true,
        secret: encryptedSecret,
        recoveryCodes: hashed,
        verifiedAt: new Date().toISOString(),
        disabledAt: null,
      },
      two_factor_pending: null,
    };

    await saveMfaPreferences(supabase, user.id, updatedPreferences);

    return NextResponse.json({
      data: {
        recoveryCodes: plain,
      },
    });
  } catch (error) {
    console.error('[settings/security/mfa/confirm][POST]', error);
    const message =
      error instanceof Error ? error.message : 'Failed to enable two-factor authentication';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

