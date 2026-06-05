import { cookies } from 'next/headers'
import { getConvexSessionFromCookieStore, isConvexAuthEnabled } from '@/lib/auth/convex-session'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

export async function getCurrentUser(cookieStore: ReturnType<typeof cookies> = cookies()) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error && user?.id) {
      return {
        user: {
          id: user.id,
          email: user.email,
          user_metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
        } satisfies CurrentUser,
        error: null,
      }
    }
  } catch (error) {
    if (!isConvexAuthEnabled()) {
      return { user: null, error }
    }
  }

  if (isConvexAuthEnabled()) {
    const session = await getConvexSessionFromCookieStore(cookieStore)
    if (session) {
      return {
        user: {
          id: session.sub,
          email: session.email,
          user_metadata: session.userMetadata ?? {},
        } satisfies CurrentUser,
        error: null,
      }
    }
  }

  return { user: null, error: new Error('Unauthorized') }
}
