import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAuthBackend, getConvexSessionFromCookieStore } from '@/lib/auth/convex-session'
import { createMirroredSupabaseClient } from '@/lib/convex/supabase-runtime-mirror'
import { getConvexAuthUserLegacyId, getConvexDocumentByLegacyId } from '@/lib/convex/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createClient() {
  const cookieStore = cookies()

  if (getAuthBackend() === 'convex') {
    return createConvexOnlyServerClient(cookieStore) as any
  }
  
  const client = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  return createMirroredSupabaseClient(client as any)
}

function createConvexOnlyServerClient(cookieStore: ReturnType<typeof cookies>) {
  // Resolve the current user from the hand-rolled HMAC session first; if absent and
  // running @convex-dev/auth, fall back to the Convex Auth token (mapped to the
  // Supabase UUID via legacyId).
  async function resolveUser() {
    const session = await getConvexSessionFromCookieStore(cookieStore)
    if (session) {
      return { id: session.sub, email: session.email, user_metadata: session.userMetadata ?? {} }
    }
    if (getAuthBackend() === 'convex') {
      const identity = await getConvexAuthUserLegacyId()
      if (identity?.legacyId) {
        // Enrich the @convex-dev/auth token identity with the user's profile metadata
        // (full_name/name/avatar) from the mirrored supabase_auth_users row, so the UI
        // shows the real name instead of the "DefaultUser" fallback.
        let userMetadata: Record<string, unknown> = {}
        try {
          const authRow = (await getConvexDocumentByLegacyId('supabase_auth_users', identity.legacyId)) as
            | { user_metadata?: Record<string, unknown>; raw_user_meta_data?: Record<string, unknown> }
            | null
          userMetadata = authRow?.user_metadata ?? authRow?.raw_user_meta_data ?? {}
        } catch {
          /* non-fatal — fall back to empty metadata */
        }
        return { id: identity.legacyId, email: identity.email ?? '', user_metadata: userMetadata }
      }
    }
    return null
  }

  return {
    auth: {
      async getUser() {
        const user = await resolveUser()
        return {
          data: { user },
          error: user ? null : new Error('Auth session missing'),
        }
      },
      async getSession() {
        const user = await resolveUser()
        return {
          data: { session: user ? { user } : null },
          error: null,
        }
      },
      async setSession() {
        return { data: { session: null }, error: new Error('Supabase auth is disabled in Convex auth mode') }
      },
      async updateUser() {
        return { data: { user: null }, error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
    from() {
      throw new Error('Supabase database is disabled in Convex auth mode')
    },
    rpc() {
      throw new Error('Supabase RPC is disabled in Convex auth mode')
    },
  }
}
