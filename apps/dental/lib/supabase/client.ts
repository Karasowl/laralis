import { createBrowserClient } from '@supabase/ssr'

const AUTH_SYNC_METHODS = new Set([
  'exchangeCodeForSession',
  'setSession',
  'signInWithOtp',
  'signInWithPassword',
  'signUp',
  'updateUser',
  'verifyOtp',
])

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authBackend = getClientAuthBackend()

  if ((!supabaseUrl || !supabaseAnonKey) && authBackend === 'convex') {
    return createConvexOnlyBrowserClient() as any
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )

  return createBrowserAuthSyncClient(client as any, authBackend)
}

function createConvexOnlyBrowserClient() {
  const missing = async () => ({ data: null, error: new Error('Supabase auth is disabled in Convex auth mode') })

  return {
    auth: {
      signInWithPassword: missing,
      signInWithOtp: missing,
      signUp: missing,
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: missing,
      exchangeCodeForSession: missing,
      setSession: missing,
      updateUser: async () => ({ data: null, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      resend: missing,
      verifyOtp: missing,
    },
  }
}

function createBrowserAuthSyncClient(client: any, authBackend: 'supabase' | 'dual' | 'convex') {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'auth') {
        return wrapBrowserAuth(Reflect.get(target, prop, receiver), authBackend)
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function wrapBrowserAuth(auth: any, authBackend: 'supabase' | 'dual' | 'convex') {
  if (!auth || typeof auth !== 'object') return auth

  return new Proxy(auth, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      if ((prop === 'getUser' || prop === 'getSession') && authBackend !== 'supabase') {
        return async (...args: unknown[]) => {
          if (args.length > 0) return value.apply(target, args)

          const currentUser = await getCurrentUserFromServer()
          if (currentUser.user) {
            if (prop === 'getUser') {
              return { data: { user: currentUser.user }, error: null }
            }
            return {
              data: {
                session: {
                  access_token: '',
                  refresh_token: '',
                  expires_in: 0,
                  token_type: 'bearer',
                  user: currentUser.user,
                },
              },
              error: null,
            }
          }

          if (authBackend === 'convex') {
            return prop === 'getUser'
              ? { data: { user: null }, error: currentUser.error }
              : { data: { session: null }, error: currentUser.error }
          }

          return value.apply(target, args)
        }
      }

      if (AUTH_SYNC_METHODS.has(String(prop))) {
        return async (...args: unknown[]) => {
          const result = await value.apply(target, args)
          if (!result?.error) {
            void syncCurrentUserToConvex()
          }
          return result
        }
      }

      return value.bind(target)
    },
  })
}

function getClientAuthBackend() {
  const value = process.env.NEXT_PUBLIC_AUTH_BACKEND || 'supabase'
  return value === 'convex' || value === 'dual' ? value : 'supabase'
}

async function getCurrentUserFromServer(): Promise<{ user: any; error: Error | null }> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
    if (response.ok) {
      const payload = await response.json()
      return { user: payload?.user ?? null, error: null }
    }
    return { user: null, error: new Error('Auth session missing') }
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error : new Error('Failed to resolve current user'),
    }
  }
}

async function syncCurrentUserToConvex() {
  try {
    await fetch('/api/auth/convex-sync-user', { method: 'POST' })
  } catch (error) {
    console.error('[supabase client] Convex user sync failed', error)
  }
}
