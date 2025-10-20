import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {

export const dynamic = 'force-dynamic'

  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  verifyTotpToken,
} from '@/lib/security/totp';

const confirmSchema = z.object({
  code: z.string().min(6).max(10),
});

function ensurePreferences(input: unknown): Record<string, any> {
  if (typeof input === 'object' && input !== null) {
    return input as Record<string, any>;
  }
  return {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

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

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ preferences: updatedPreferences })
      .eq('id', session.user.id);

    if (updateError) {
      throw updateError;
    }

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

