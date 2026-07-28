import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { hashPasswordForBridge } from '@/lib/auth/password-bridge'
import { getConvexHttpClient } from '@/lib/convex/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const bridgeSecret = process.env.CONVEX_AUTH_BRIDGE_SECRET

  if (!bridgeSecret) {
    return NextResponse.json({ ok: true, enabled: false })
  }

  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password || email !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Invalid bridge payload' }, { status: 400 })
  }

  const passwordCredential = await hashPasswordForBridge(password)

  await getConvexHttpClient().mutation(api.authBridge.upsertPasswordCredential, {
    secret: bridgeSecret,
    supabaseUserId: user.id,
    email,
    ...passwordCredential,
    userMetadata: user.user_metadata ?? {},
  })

  return NextResponse.json({ ok: true, enabled: true })
}
