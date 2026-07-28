import { NextRequest, NextResponse } from 'next/server'
import {
  CONVEX_SESSION_COOKIE_NAME,
  createConvexSessionToken,
} from '@/lib/auth/convex-session'
import { hashConvexPasswordResetToken } from '@/lib/auth/convex-password-reset'
import { hashPasswordForBridge } from '@/lib/auth/password-bridge'
import {
  consumeConvexPasswordReset,
  getConvexAuthContext,
} from '@/lib/convex/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const sessionSecret = process.env.CONVEX_AUTH_SESSION_SECRET
  if (!sessionSecret) {
    return NextResponse.json({ error: 'Convex auth session is not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const passwordCredential = await hashPasswordForBridge(password)
  let credential: Awaited<ReturnType<typeof consumeConvexPasswordReset>>
  try {
    credential = await consumeConvexPasswordReset({
      tokenHash: hashConvexPasswordResetToken(token),
      ...passwordCredential,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid or expired reset token' },
      { status: 400 }
    )
  }

  const context = await getConvexAuthContext(credential.supabaseUserId)
  const sessionToken = await createConvexSessionToken(
    {
      sub: credential.supabaseUserId,
      email: credential.email,
      userMetadata: credential.userMetadata ?? {},
      workspaceId: context.defaultWorkspace?.id ?? null,
      clinicId: context.defaultClinic?.id ?? null,
    },
    sessionSecret
  )

  const response = NextResponse.json({
    ok: true,
    user: {
      id: credential.supabaseUserId,
      email: credential.email,
      user_metadata: credential.userMetadata ?? {},
    },
    workspaceId: context.defaultWorkspace?.id ?? null,
    clinicId: context.defaultClinic?.id ?? null,
  })

  response.cookies.set(CONVEX_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  if (context.defaultWorkspace?.id) {
    response.cookies.set('workspaceId', context.defaultWorkspace.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }

  if (context.defaultClinic?.id) {
    response.cookies.set('clinicId', context.defaultClinic.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }

  return response
}
