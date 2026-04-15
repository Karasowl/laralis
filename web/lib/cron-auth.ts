import { NextRequest, NextResponse } from 'next/server'

/**
 * Authentication guard for cron endpoints.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on every
 * scheduled invocation. This helper enforces that header on every
 * request, regardless of NODE_ENV. The previous per-route checks had
 * `if (process.env.NODE_ENV === 'production')` bypasses that left
 * preview / development deployments wide open — anyone could trigger
 * cron-only writes by hitting the URL.
 *
 * Returns `null` when authorized; otherwise an HTTP response that the
 * caller should return immediately.
 *
 * Usage:
 *
 *   export async function POST(req: NextRequest) {
 *     const denied = requireCronAuth(req)
 *     if (denied) return denied
 *     // ... privileged work
 *   }
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Misconfiguration is a config bug, not an auth bypass.
    console.error('[cron-auth] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  const header = request.headers.get('authorization') || ''
  // Constant prefix; comparing the rest in constant time avoids
  // micro-leaks via early-exit string comparison.
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
