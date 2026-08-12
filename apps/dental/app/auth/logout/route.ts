import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CONVEX_SESSION_COOKIE_NAME, getAuthBackend } from '@/lib/auth/convex-session';
import { resolveServerAuthUser } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const authBackend = getAuthBackend();

  if (authBackend !== 'convex' && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createSupabaseServerClient(cookieStore);
    const resolution = await resolveServerAuthUser({
      cookieStore,
      authBackend,
      getSupabaseUser: () => supabase.auth.getUser(),
    });

    // A valid Convex identity is enough to complete logout locally. Only a true
    // Supabase session, or pure Supabase mode, needs the remote sign-out call.
    if (authBackend === 'supabase' || resolution.source === 'supabase') {
      await supabase.auth.signOut();
    }
  }

  // Limpiar cookies
  const response = NextResponse.redirect(new URL('/auth/login', request.url));
  
  // Eliminar cookies de workspace y clinic
  response.cookies.delete('workspaceId');
  response.cookies.delete('clinicId');
  response.cookies.delete(CONVEX_SESSION_COOKIE_NAME);
  response.cookies.delete('__convexAuthJWT');
  response.cookies.delete('__convexAuthRefreshToken');
  response.cookies.delete('__convexAuthOAuthVerifier');
  response.cookies.delete('__Host-__convexAuthJWT');
  response.cookies.delete('__Host-__convexAuthRefreshToken');
  response.cookies.delete('__Host-__convexAuthOAuthVerifier');
  
  return response;
}
