import { NextResponse } from 'next/server'
import { upsertConvexDocumentByLegacyId } from '@/lib/convex/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL || !process.env.CONVEX_AUTH_BRIDGE_SECRET) {
    return NextResponse.json({ ok: true, enabled: false })
  }

  // This endpoint mirrors the freshly-mutated Supabase user record. Reading a
  // Convex identity here would only write the old mirror back to itself.
  const supabase = createSupabaseServerClient()
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
