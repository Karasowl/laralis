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

const regenerateSchema = z.object({
  code: z.string().min(6).max(10),
});

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    const parsed = regenerateSchema.safeParse(body);

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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authError) throw authError;

    const preferences = await loadMfaPreferences(supabase, user.id);
    const current = preferences.two_factor;

    if (!current?.enabled || !current?.secret) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 },
      );
    }

    const secret = decryptSecret(current.secret);
    const isValid = verifyTotpToken(secret, parsed.data.code);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 },
      );
    }

    const { plain, hashed } = generateRecoveryCodes();
    const updatedPreferences = {
      ...preferences,
      two_factor: {
        ...current,
        secret: encryptSecret(secret),
        recoveryCodes: hashed,
        verifiedAt: current.verifiedAt ?? new Date().toISOString(),
      },
    };

    await saveMfaPreferences(supabase, user.id, updatedPreferences);

    return NextResponse.json({
      data: {
        recoveryCodes: plain,
      },
    });
  } catch (error) {
    console.error('[settings/security/mfa/recovery][POST]', error);
    const message =
      error instanceof Error ? error.message : 'Failed to regenerate recovery codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

