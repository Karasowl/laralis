import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CONVEX_SESSION_COOKIE_NAME } from '@/lib/auth/convex-session';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

    // Cerrar sesión
    await supabase.auth.signOut();
  }

  // Limpiar cookies
  const response = NextResponse.redirect(new URL('/auth/login', request.url));
  
  // Eliminar cookies de workspace y clinic
  response.cookies.delete('workspaceId');
  response.cookies.delete('clinicId');
  response.cookies.delete(CONVEX_SESSION_COOKIE_NAME);
  
  return response;
}
