import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import {
  CONVEX_SESSION_COOKIE_NAME,
  createConvexSessionToken,
} from '@/lib/auth/convex-session'
import { verifyBridgePassword } from '@/lib/auth/password-bridge'
import { getConvexAuthContext, getConvexHttpClient } from '@/lib/convex/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const bridgeSecret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  const sessionSecret = process.env.CONVEX_AUTH_SESSION_SECRET

  if (!bridgeSecret || !sessionSecret) {
    return NextResponse.json({ error: 'Convex auth is not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const credential = await getConvexHttpClient().query(api.authBridge.credentialByEmail, {
    secret: bridgeSecret,
    email,
  })

  if (!credential) {
    return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 })
  }

  const isValid = await verifyBridgePassword(password, credential.passwordHash, credential.passwordSalt)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 })
  }

  const context = await getConvexAuthContext(credential.supabaseUserId)
  const token = await createConvexSessionToken(
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

  response.cookies.set(CONVEX_SESSION_COOKIE_NAME, token, {
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
