import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptSecret, generateTotpSetup } from '@/lib/security/totp';
import { loadMfaPreferences, saveMfaPreferences } from '@/lib/security/mfa-preferences';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  void request;
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

    const email = user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found for user' },
        { status: 400 },
      );
    }

    const preferences = await loadMfaPreferences(supabase, user.id);
    const twoFactor = preferences.two_factor;

    if (twoFactor?.enabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 },
      );
    }

    const setup = await generateTotpSetup(email);
    const encryptedSecret = encryptSecret(setup.secret);

    const updatedPreferences = {
      ...preferences,
      two_factor_pending: {
        secret: encryptedSecret,
        createdAt: new Date().toISOString(),
      },
    };

    await saveMfaPreferences(supabase, user.id, updatedPreferences);

    return NextResponse.json({
      data: {
        secret: setup.secret,
        otpauth: setup.otpauth,
        qrCodeDataUrl: setup.qrCodeDataUrl,
      },
    });
  } catch (error) {
    console.error('[settings/security/mfa/setup][POST]', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to initialize two-factor authentication';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

