import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/test-auth'
  ) {
    return NextResponse.next();
  }

  // Create a single response object that will be modified and returned
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Get cookie value from request
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on both request and response
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from both request and response
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session and get user
  const { data: { user }, error } = await supabase.auth.getUser()
  
  // Also try to refresh the session if there's an error
  if (error && !pathname.startsWith('/auth')) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      })
    }
  }
  
  // Temporary debug log for authentication issues
  if (pathname === '/' || pathname.startsWith('/auth')) {
    console.log(`[Middleware] Path: ${pathname}, User: ${user?.email || 'none'}, Error: ${error?.message || 'none'}`)
  }

  // Public paths that don't require authentication
  const publicPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/auth/logout',
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isOnboarding = pathname === '/onboarding';

  // If no user and trying to access protected route
  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If has user and trying to access auth pages (except logout/callback/reset-password)
  if (user && isPublicPath && 
      !pathname.includes('/logout') && 
      !pathname.includes('/callback') && 
      !pathname.includes('/reset-password')) {
    // Check if user has workspace
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    } else {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // If authenticated and not in onboarding, check for workspace
  if (user && !isPublicPath && !isOnboarding) {
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  // If in onboarding and already has workspace, redirect to home
  if (user && isOnboarding) {
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};