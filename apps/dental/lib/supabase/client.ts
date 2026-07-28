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

  if ((!supabaseUrl || !supabaseAnonKey) && process.env.NEXT_PUBLIC_AUTH_BACKEND === 'convex') {
    return createConvexOnlyBrowserClient() as any
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )

  return createBrowserAuthSyncClient(client as any)
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

function createBrowserAuthSyncClient(client: any) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'auth') {
        return wrapBrowserAuth(Reflect.get(target, prop, receiver))
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function wrapBrowserAuth(auth: any) {
  if (!auth || typeof auth !== 'object') return auth

  return new Proxy(auth, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

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

async function syncCurrentUserToConvex() {
  try {
    await fetch('/api/auth/convex-sync-user', { method: 'POST' })
  } catch (error) {
    console.error('[supabase client] Convex user sync failed', error)
  }
}
