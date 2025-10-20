import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type RateLimitResult = Awaited<ReturnType<Ratelimit['limit']>>;

let cachedRateLimiter: Ratelimit | null | undefined;

function getRateLimiter(): Ratelimit | null {
  if (cachedRateLimiter !== undefined) {
    return cachedRateLimiter;
  }

  const hasEnv = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!hasEnv) {
    cachedRateLimiter = null;
    return cachedRateLimiter;
  }

  try {
    const redis = Redis.fromEnv();
    cachedRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'laralis:ratelimit',
    });
  } catch (error) {
    console.error('Rate limiter initialization failed', error);
    cachedRateLimiter = null;
  }

  return cachedRateLimiter;
}

function setRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  options: { includeRetryAfter?: boolean } = {}
) {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.reset));

  if (options.includeRetryAfter) {
    const retryAfterSeconds = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
    response.headers.set('Retry-After', retryAfterSeconds.toString());
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStaticAsset = pathname.startsWith('/_next') || pathname.includes('.') || pathname === '/test-auth';

  const limiter = getRateLimiter();
  let rateLimitResult: RateLimitResult | null = null;

  if (!isStaticAsset && limiter) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const identifier = `${ip}:${request.method}:${pathname}`;
    rateLimitResult = await limiter.limit(identifier);

    if (!rateLimitResult.success) {
      const limitedResponse = NextResponse.json(
        { message: 'Demasiadas peticiones, intenta nuevamente en unos segundos.' },
        { status: 429 }
      );
      setRateLimitHeaders(limitedResponse, rateLimitResult, { includeRetryAfter: true });
      return limitedResponse;
    }
  }

  if (isStaticAsset) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api')) {
    const apiResponse = NextResponse.next();
    if (rateLimitResult) {
      setRateLimitHeaders(apiResponse, rateLimitResult);
    }
    return apiResponse;
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
  
  // Limit debug logs to development only (disabled for performance)
  // if (process.env.NODE_ENV !== 'production') {
  //   if (pathname === '/' || pathname.startsWith('/auth')) {
  //     console.log(`[Middleware] Path: ${pathname}, User: ${user?.email || 'none'}, Error: ${error?.message || 'none'}`)
  //   }
  // }

  // Public paths that don't require authentication
  const publicPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/callback',
    '/auth/logout',
    '/auth/verify-email',
    '/terms',
    '/privacy',
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isOnboarding = pathname === '/onboarding';
  const isSetup = pathname.startsWith('/setup');

  // If no user and trying to access protected route
  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If has user and trying to access auth pages (except logout/callback/reset-password/verify-email)
  if (user && isPublicPath &&
      !pathname.includes('/logout') &&
      !pathname.includes('/callback') &&
      !pathname.includes('/reset-password') &&
      !pathname.includes('/verify-email')) {
    // Check if user has workspace (cached check)
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!workspaces) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    } else {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // If user already has at least one workspace and tries to access onboarding,
  // redirect to the full initial setup page instead of the modal flow.
  if (user && pathname === '/onboarding') {
    const { data: hasWorkspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();
    if (hasWorkspace) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  }

  // If authenticated and not in onboarding, check for workspace
  // Do not bounce away from setup while the just-created workspace propagates.
  if (user && !isPublicPath && !isOnboarding && !isSetup) {
    const cookieWs = request.cookies.get('workspaceId')?.value

    // Only check database if no workspace cookie exists
    if (!cookieWs) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!workspace) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    }
  }

  // Keep onboarding accessible even if a workspace already exists.
  // The app itself decides when onboarding is completed.

  if (rateLimitResult) {
    setRateLimitHeaders(response, rateLimitResult);
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
