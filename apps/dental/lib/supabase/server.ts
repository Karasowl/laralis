import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAuthBackend } from '@/lib/auth/convex-session'
import { resolveServerAuthUser, type ServerAuthResolution } from '@/lib/auth/server-auth'
import { createMirroredSupabaseClient } from '@/lib/convex/supabase-runtime-mirror'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createClient(cookieStore = cookies()) {
  const authBackend = getAuthBackend()

  if (authBackend === 'convex') {
    return createConvexOnlyServerClient(cookieStore) as any
  }

  const client = createSupabaseServerClient(cookieStore)
  const authAwareClient = createConvexFirstAuthClient(client as any, cookieStore, authBackend)

  return createMirroredSupabaseClient(authAwareClient as any)
}

/**
 * Raw Supabase protocol client. Keep this explicit and rare. It is only for flows
 * that must talk to Supabase itself, such as PKCE exchange, Supabase OTP, or
 * mirroring a user immediately after a Supabase metadata mutation.
 */
export function createSupabaseServerClient(cookieStore = cookies()) {
  return createServerClient(
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
}

function createConvexOnlyServerClient(cookieStore: ReturnType<typeof cookies>) {
  let resolution: Promise<ServerAuthResolution> | null = null
  const resolveUser = () => {
    resolution ??= resolveServerAuthUser({ cookieStore, authBackend: 'convex' })
    return resolution
  }

  return {
    auth: {
      async getUser() {
        const { user, error } = await resolveUser()
        return {
          data: { user },
          error,
        }
      },
      async getSession() {
        const { user, error } = await resolveUser()
        return {
          data: { session: user ? createConvexCompatibleSession(user) : null },
          error,
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

function createConvexFirstAuthClient(
  client: any,
  cookieStore: ReturnType<typeof cookies>,
  authBackend: ReturnType<typeof getAuthBackend>
) {
  let resolution: Promise<ServerAuthResolution> | null = null
  const resolveUser = () => {
    resolution ??= resolveServerAuthUser({
      cookieStore,
      authBackend,
      getSupabaseUser: () => client.auth.getUser(),
    })
    return resolution
  }

  const auth = new Proxy(client.auth, {
    get(target, prop, receiver) {
      if (prop === 'getUser') {
        return async (...args: unknown[]) => {
          if (args.length > 0) return target.getUser(...args)
          const { user, error } = await resolveUser()
          return { data: { user }, error }
        }
      }

      if (prop === 'getSession') {
        return async () => {
          const resolved = await resolveUser()
          if (resolved.source === 'supabase') {
            return target.getSession()
          }
          return {
            data: {
              session: resolved.user ? createConvexCompatibleSession(resolved.user) : null,
            },
            error: resolved.error,
          }
        }
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'auth') return auth
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function createConvexCompatibleSession(user: Record<string, unknown>) {
  return {
    access_token: '',
    refresh_token: '',
    expires_in: 0,
    token_type: 'bearer',
    user,
  }
}
