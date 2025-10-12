import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptSecret, generateTotpSetup } from '@/lib/security/totp';

function ensurePreferences(input: unknown): Record<string, any> {
  if (typeof input === 'object' && input !== null) {
    return input as Record<string, any>;
  }
  return {};
}

export async function POST(request: NextRequest) {
  void request;
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
      .select('preferences, email')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const email = data?.email || session.user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found for user' },
        { status: 400 },
      );
    }

    const preferences = ensurePreferences(data?.preferences);
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

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ preferences: updatedPreferences })
      .eq('id', session.user.id);

    if (updateError) {
      throw updateError;
    }

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

