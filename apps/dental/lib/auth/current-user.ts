import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

export async function getCurrentUser(cookieStore: ReturnType<typeof cookies> = cookies()) {
  try {
    const supabase = createClient(cookieStore)
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
    return { user: null, error: error ?? new Error('Unauthorized') }
  } catch (error) {
    return { user: null, error }
  }
}
