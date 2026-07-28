import { NextResponse } from 'next/server'
import { upsertConvexDocumentByLegacyId } from '@/lib/convex/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL || !process.env.CONVEX_AUTH_BRIDGE_SECRET) {
    return NextResponse.json({ ok: true, enabled: false })
  }

  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await upsertConvexDocumentByLegacyId(
    'supabase_auth_users',
    user.id,
    JSON.parse(JSON.stringify(user)) as Record<string, unknown>
  )

  return NextResponse.json({ ok: true, enabled: true })
}
