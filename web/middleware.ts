import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files, api routes, and onboarding
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/onboarding') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if workspace exists by calling the API
  try {
    const response = await fetch(`${request.nextUrl.origin}/api/workspaces`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // If no workspace exists, redirect to onboarding
      if (!data.workspace) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    }
  } catch (error) {
    console.error('Middleware error:', error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - onboarding (onboarding page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|onboarding).*)',
  ],
};