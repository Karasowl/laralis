import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';
import {
  CONVEX_SESSION_COOKIE_NAME,
  getAuthBackend,
  isConvexAuthEnabled,
  verifyConvexSessionToken,
} from './lib/auth/convex-session';

// Shared public-path list (used by both the supabase and convex middleware paths).
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/convex-reset-password',
  '/auth/callback',
  '/auth/logout',
  '/auth/verify-email',
  '/terms',
  '/privacy',
  '/book', // Public booking pages
];

/**
 * Rate limiting lives in the Vercel Firewall, not here.
 *
 * The previous implementation used @upstash/ratelimit inside supabaseMiddleware,
 * and it never protected anything: the matcher below excludes /api (so login,
 * public booking and the AI routes were never covered), the convex branch never
 * called the limiter at all, and UPSTASH_REDIS_REST_URL was not set in any
 * environment, so getRateLimiter() always returned null. Keeping that code around
 * only advertised a protection that did not exist.
 *
 * Firewall rules are declared in scripts/firewall/rules.sh and cut traffic at the
 * edge, before a function is invoked, so they cover /api regardless of auth backend
 * and blocked requests are not billed.
 */

/**
 * Hard ceiling for any Supabase call made from the middleware.
 *
 * Vercel kills a middleware invocation that does not answer within 25s and returns
 * 504 MIDDLEWARE_INVOCATION_TIMEOUT. supabase-js retries network failures with an
 * exponential backoff, so a Supabase host that is paused, deleted or simply
 * unreachable turns a single getUser() into tens of seconds and takes the whole app
 * down for every signed-in user. The middleware only needs Supabase to decide where
 * to route the request, so a slow answer is worth exactly as much as no answer.
 */
const SUPABASE_CALL_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = SUPABASE_CALL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

async function supabaseMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api is matched only for /api/auth (the convex auth proxy). In supabase mode that
  // route must pass through untouched — early-return preserves the prior behavior
  // (where /api was not matched at all).
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const isStaticAsset = pathname.startsWith('/_next') || pathname.includes('.') || pathname === '/test-auth';

  if (isStaticAsset) {
    return NextResponse.next();
  }

  // Create a single response object that will be modified and returned
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const authBackend = getAuthBackend();

  // Resolve the Convex session FIRST: it is an HMAC check on a cookie, no network at
  // all. When it succeeds the request is already authenticated, so there is nothing
  // Supabase can add and we skip it entirely (see SUPABASE_CALL_TIMEOUT_MS above).
  // Both backends key identity off the same Supabase UUID (`sub` === the mirrored
  // supabaseUserId), so short-circuiting here does not change who the user is.
  const convexSession = isConvexAuthEnabled()
    ? await verifyConvexSessionToken(
        request.cookies.get(CONVEX_SESSION_COOKIE_NAME)?.value,
        process.env.CONVEX_AUTH_SESSION_SECRET
      )
    : null;

  const hasSupabaseAuthEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const shouldUseSupabaseAuth = authBackend !== 'convex' && hasSupabaseAuthEnv && !convexSession;
  const supabase = shouldUseSupabaseAuth
    ? createServerClient(
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
      )
    : null;

  // Refresh session and get user. Timing out is treated as "no Supabase user": the
  // Convex session (resolved above) still decides, and an unreachable Supabase can no
  // longer stall the invocation past Vercel's 25s limit.
  const { user, error } = supabase
    ? await withTimeout(
        supabase.auth.getUser().then((result) => ({
          user: result.data.user,
          error: result.error,
        })),
        { user: null, error: null }
      )
    : { user: null, error: null };
  const authUser = user ?? (convexSession
    ? {
        id: convexSession.sub,
        email: convexSession.email,
      }
    : null);
  
  // Also try to refresh the session if there's an error. Best-effort only: this is a
  // recovery attempt, never a reason to hold the request open.
  if (supabase && error && !pathname.startsWith('/auth')) {
    const session = await withTimeout(
      supabase.auth.getSession().then((result) => result.data.session),
      null
    )
    if (session) {
      await withTimeout(
        supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        }).then(() => null),
        null
      )
    }
  }
  
  // Limit debug logs to development only (disabled for performance)
  // if (process.env.NODE_ENV !== 'production') {
  //   if (pathname === '/' || pathname.startsWith('/auth')) {
  //     console.log(`[Middleware] Path: ${pathname}, User: ${user?.email || 'none'}, Error: ${error?.message || 'none'}`)
  //   }
  // }

  // Public paths that don't require authentication
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  const isOnboarding = pathname === '/onboarding';
  const isSetup = pathname.startsWith('/setup');
  const workspaceLifecycleSelect = 'id, status, onboarding_completed';
  const workspaceLifecycleFallbackSelect = 'id, onboarding_completed';
  const shouldRetryWorkspaceLifecycleWithoutStatus = (workspaceError: any) => {
    const message = String(workspaceError?.message || '').toLowerCase();
    return message.includes('status') && message.includes('column');
  };
  // `null` means "could not be determined" (Supabase unreachable/slow) and must never
  // be read as "this user has no workspace" — that would bounce a valid user into
  // onboarding. Callers keep the user where they are instead.
  const WORKSPACE_LOOKUP_TIMEOUT_MS = 4000;
  const resolveWorkspaceDestination = (workspaces: any[] | null | undefined) => {
    const rows = workspaces || [];
    const visible = rows.filter((workspace) => !['archived', 'pending_deletion', 'deleted'].includes(
      workspace?.status || (workspace?.onboarding_completed ? 'active' : 'draft')
    ));
    if (visible.length === 0) return '/onboarding';
    if (visible.some((workspace) => (workspace?.status || (workspace?.onboarding_completed ? 'active' : 'draft')) === 'active')) {
      return '/';
    }
    return '/setup/resume';
  };
  const getAccessibleWorkspaces = async (userId: string) => {
    if (convexSession?.sub === userId) {
      return convexSession.workspaceId
        ? [{ id: convexSession.workspaceId, status: 'active', onboarding_completed: true }]
        : [];
    }

    if (!supabase) return [];

    const workspaceMap = new Map<string, any>();

    let { data: ownedWorkspaces, error: ownedWorkspacesError } = await supabase
      .from('workspaces')
      .select(workspaceLifecycleSelect)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (ownedWorkspacesError && shouldRetryWorkspaceLifecycleWithoutStatus(ownedWorkspacesError)) {
      const fallback = await supabase
        .from('workspaces')
        .select(workspaceLifecycleFallbackSelect)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      ownedWorkspaces = (fallback.data || []).map((workspace) => ({
        ...workspace,
        status: workspace.onboarding_completed ? 'active' : 'draft',
      }));
    }

    for (const workspace of ownedWorkspaces || []) {
      workspaceMap.set(workspace.id, workspace);
    }

    const membershipWorkspaceIds = new Set<string>();
    for (const table of ['workspace_users', 'workspace_members']) {
      const { data: memberships, error: membershipError } = await supabase
        .from(table)
        .select('workspace_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (membershipError) continue;

      for (const membership of memberships || []) {
        if (membership.workspace_id) membershipWorkspaceIds.add(membership.workspace_id);
      }
    }

    const missingIds = Array.from(membershipWorkspaceIds).filter((id) => !workspaceMap.has(id));
    if (missingIds.length > 0) {
      let { data: memberWorkspaces, error: memberWorkspacesError } = await supabase
        .from('workspaces')
        .select(workspaceLifecycleSelect)
        .in('id', missingIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (memberWorkspacesError && shouldRetryWorkspaceLifecycleWithoutStatus(memberWorkspacesError)) {
        const fallback = await supabase
          .from('workspaces')
          .select(workspaceLifecycleFallbackSelect)
          .in('id', missingIds)
          .order('created_at', { ascending: false })
          .limit(10);
        memberWorkspaces = (fallback.data || []).map((workspace) => ({
          ...workspace,
          status: workspace.onboarding_completed ? 'active' : 'draft',
        }));
      }

      for (const workspace of memberWorkspaces || []) {
        workspaceMap.set(workspace.id, workspace);
      }
    }

    return Array.from(workspaceMap.values());
  };

  // Same contract as getAccessibleWorkspaces, except a timeout or a thrown error
  // resolves to `null` (unknown) instead of hanging the invocation.
  const getAccessibleWorkspacesOrUnknown = (userId: string): Promise<any[] | null> =>
    withTimeout<any[] | null>(getAccessibleWorkspaces(userId), null, WORKSPACE_LOOKUP_TIMEOUT_MS);

  // If no user and trying to access protected route
  if (!authUser && !isPublicPath) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If has user and trying to access auth pages (except logout/callback/reset-password/verify-email/book)
  if (authUser && isPublicPath &&
      !pathname.includes('/logout') &&
      !pathname.includes('/callback') &&
      !pathname.includes('/reset-password') &&
      !pathname.includes('/verify-email') &&
      !pathname.startsWith('/book')) {
    // Check if user has workspace (cached check). If the lookup could not resolve,
    // send them home and let the page layer figure out the lifecycle screen.
    const workspaces = await getAccessibleWorkspacesOrUnknown(authUser.id);
    const destination = workspaces === null ? '/' : resolveWorkspaceDestination(workspaces);

    return NextResponse.redirect(new URL(destination, request.url));
  }

  // If user already has a usable workspace and tries onboarding, send them to
  // the correct lifecycle screen. Archived/deleted workspaces do not block a
  // fresh onboarding.
  if (authUser && pathname === '/onboarding') {
    const workspaces = await getAccessibleWorkspacesOrUnknown(authUser.id);
    const destination = workspaces === null ? '/onboarding' : resolveWorkspaceDestination(workspaces);
    if (destination !== '/onboarding') {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  // If authenticated and not in onboarding, check for workspace
  // Do not bounce away from setup while the just-created workspace propagates.
  if (authUser && !isPublicPath && !isOnboarding && !isSetup) {
    const cookieWs = request.cookies.get('workspaceId')?.value

    // Only check database if no workspace cookie exists
    if (!cookieWs) {
      const workspace = await getAccessibleWorkspacesOrUnknown(authUser.id);

      // Unknown => let the request through untouched instead of redirecting an
      // authenticated user to onboarding on a transient backend failure.
      if (workspace !== null) {
        const destination = resolveWorkspaceDestination(workspace);
        if (destination !== '/') {
          return NextResponse.redirect(new URL(destination, request.url));
        }
      }
    }
  }

  // Keep onboarding accessible even if a workspace already exists.
  // The app itself decides when onboarding is completed.

  return response;
}

// Convex Auth path: convexAuthNextjsMiddleware owns the request (refreshes tokens,
// proxies the /api/auth auth route) and our handler does the route gating. Workspace
// destination redirects are deferred to the page layer in convex mode (follow-up).
const convexMiddleware = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const { pathname } = request.nextUrl;
  // Let the auth proxy + API/asset routes through.
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return;
  }
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const authed = await convexAuth.isAuthenticated();

  if (!authed && !isPublic) {
    return nextjsMiddlewareRedirect(request, '/auth/login');
  }

  if (
    authed &&
    isPublic &&
    !pathname.includes('/logout') &&
    !pathname.includes('/callback') &&
    !pathname.includes('/reset-password') &&
    !pathname.includes('/verify-email') &&
    !pathname.startsWith('/book')
  ) {
    return nextjsMiddlewareRedirect(request, '/');
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  return getAuthBackend() === 'convex'
    ? convexMiddleware(request, event)
    : supabaseMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes) — EXCEPT /api/auth (the convex auth proxy, below)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // The convex auth proxy endpoint (default apiRoute '/api/auth'). In supabase
    // mode supabaseMiddleware early-returns NextResponse.next() for any /api path,
    // so this match is a no-op there.
    '/api/auth',
    '/api/auth/:path*',
  ],
};
