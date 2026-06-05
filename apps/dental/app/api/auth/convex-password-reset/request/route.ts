import { NextRequest, NextResponse } from 'next/server'
import {
  authorizeMigrationSecret,
  createConvexPasswordResetToken,
  getRequestOrigin,
  hashConvexPasswordResetToken,
} from '@/lib/auth/convex-password-reset'
import { createConvexPasswordReset } from '@/lib/convex/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const authError = authorizeMigrationSecret(request)
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const ttlMinutes = clampTtlMinutes(body?.ttlMinutes)

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const token = createConvexPasswordResetToken()
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()

  let reset: Awaited<ReturnType<typeof createConvexPasswordReset>>
  try {
    reset = await createConvexPasswordReset({
      email,
      tokenHash: hashConvexPasswordResetToken(token),
      expiresAt,
      createdBy: 'migration-bootstrap',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Convex reset link' },
      { status: 400 }
    )
  }

  const resetUrl = new URL('/auth/convex-reset-password', getRequestOrigin(request))
  resetUrl.searchParams.set('token', token)

  return NextResponse.json({
    ok: true,
    email: reset.email,
    expiresAt: reset.expiresAt,
    resetUrl: resetUrl.toString(),
  })
}

function clampTtlMinutes(value: unknown) {
  const parsed = Number(value ?? 120)
  if (!Number.isFinite(parsed)) return 120
  return Math.max(15, Math.min(Math.floor(parsed), 24 * 60))
}
