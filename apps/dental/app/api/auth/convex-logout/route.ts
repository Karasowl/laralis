import { NextResponse } from 'next/server'
import { CONVEX_SESSION_COOKIE_NAME } from '@/lib/auth/convex-session'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(CONVEX_SESSION_COOKIE_NAME)
  response.cookies.delete('workspaceId')
  response.cookies.delete('clinicId')
  return response
}
