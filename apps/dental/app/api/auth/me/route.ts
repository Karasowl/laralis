import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user } = await getCurrentUser(cookies())

  if (!user) {
    return NextResponse.json({ user: null, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
