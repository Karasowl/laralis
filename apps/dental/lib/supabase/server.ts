import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAuthBackend, getConvexSessionFromCookieStore } from '@/lib/auth/convex-session'
import { createMirroredSupabaseClient } from '@/lib/convex/supabase-runtime-mirror'

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
  return {
    auth: {
      async getUser() {
        const session = await getConvexSessionFromCookieStore(cookieStore)
        return {
          data: {
            user: session
              ? {
                  id: session.sub,
                  email: session.email,
                  user_metadata: session.userMetadata ?? {},
                }
              : null,
          },
          error: session ? null : new Error('Auth session missing'),
        }
      },
      async getSession() {
        const session = await getConvexSessionFromCookieStore(cookieStore)
        return {
          data: {
            session: session
              ? {
                  user: {
                    id: session.sub,
                    email: session.email,
                    user_metadata: session.userMetadata ?? {},
                  },
                }
              : null,
          },
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
