import { NextRequest, NextResponse } from 'next/server'
import { hashConvexPasswordResetToken } from '@/lib/auth/convex-password-reset'
import { verifyConvexPasswordReset } from '@/lib/convex/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const result = await verifyConvexPasswordReset(hashConvexPasswordResetToken(token))
  if (!result.ok) {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    email: result.email,
    expiresAt: result.expiresAt,
  })
}
