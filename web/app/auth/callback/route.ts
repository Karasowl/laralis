import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  const origin = requestUrl.origin;

  // Handle Supabase errors
  if (error) {
    // For password recovery errors, redirect to reset-password with error
    if (error === 'access_denied' || error_description?.includes('expired')) {
      return NextResponse.redirect(
        `${origin}/auth/reset-password?error=${error}&error_description=${encodeURIComponent(error_description || '')}`
      );
    }
    // Other errors go to login
    return NextResponse.redirect(`${origin}/auth/login?error=${error}`);
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (!sessionError) {
      // Check if this is a password recovery flow
      if (type === 'recovery') {
        // Redirect to reset password page to set new password
        return NextResponse.redirect(`${origin}/auth/reset-password?recovery=true`);
      }

      // Check if user needs onboarding
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1);

        if (!workspaces || workspaces.length === 0) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      // Default redirect to home
      return NextResponse.redirect(`${origin}/`);
    } else {
      // Session exchange failed
      return NextResponse.redirect(
        `${origin}/auth/reset-password?error=invalid_code&error_description=${encodeURIComponent(sessionError.message)}`
      );
    }
  }

  // No code provided
  return NextResponse.redirect(`${origin}/auth/login`);
}