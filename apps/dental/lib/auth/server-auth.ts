import {
  getAuthBackend,
  getConvexSessionFromCookieStore,
} from './convex-session'
import {
  getConvexAuthUserLegacyId,
  getConvexDocumentByLegacyId,
} from '@/lib/convex/server'

export type ServerAuthUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
  [key: string]: unknown
}

export type ServerAuthResolution = {
  user: ServerAuthUser | null
  error: unknown | null
  source: 'convex-session' | 'convex-auth' | 'supabase' | null
}

type CookieReader = Parameters<typeof getConvexSessionFromCookieStore>[0]

type SupabaseUserResult = {
  data: { user: ServerAuthUser | null }
  error: unknown | null
}

type ResolveServerAuthUserOptions = {
  cookieStore: CookieReader
  getSupabaseUser?: () => Promise<SupabaseUserResult>
  authBackend?: ReturnType<typeof getAuthBackend>
  getConvexSession?: typeof getConvexSessionFromCookieStore
  getConvexIdentity?: typeof getConvexAuthUserLegacyId
  getConvexProfile?: typeof getConvexDocumentByLegacyId
}

/**
 * Resolve one authenticated server identity in strict priority order.
 *
 * Both Convex session forms are verified identities. A valid HMAC cookie or
 * @convex-dev/auth token therefore completes authentication without constructing
 * or calling a Supabase auth client. Supabase remains the dual-mode fallback only
 * when neither Convex session exists.
 */
export async function resolveServerAuthUser({
  cookieStore,
  getSupabaseUser,
  authBackend = getAuthBackend(),
  getConvexSession = getConvexSessionFromCookieStore,
  getConvexIdentity = getConvexAuthUserLegacyId,
  getConvexProfile = getConvexDocumentByLegacyId,
}: ResolveServerAuthUserOptions): Promise<ServerAuthResolution> {
  let convexError: unknown = null

  if (isConvexAuthEnabledFor(authBackend)) {
    try {
      const session = await getConvexSession(cookieStore)
      if (session) {
        return {
          user: {
            id: session.sub,
            email: session.email,
            user_metadata: session.userMetadata ?? {},
          },
          error: null,
          source: 'convex-session',
        }
      }

      const identity = await getConvexIdentity()
      if (identity?.legacyId) {
        return {
          user: {
            id: identity.legacyId,
            email: identity.email,
            user_metadata: await loadConvexUserMetadata(identity.legacyId, getConvexProfile),
          },
          error: null,
          source: 'convex-auth',
        }
      }
    } catch (error) {
      convexError = error
    }
  }

  if (authBackend === 'convex') {
    return {
      user: null,
      error: convexError ?? new Error('Auth session missing'),
      source: null,
    }
  }

  if (getSupabaseUser) {
    try {
      const result = await getSupabaseUser()
      return {
        user: result.data.user,
        error: result.error,
        source: result.data.user && !result.error ? 'supabase' : null,
      }
    } catch (error) {
      return { user: null, error, source: null }
    }
  }

  return {
    user: null,
    error: convexError ?? new Error('Auth session missing'),
    source: null,
  }
}

function isConvexAuthEnabledFor(authBackend: ReturnType<typeof getAuthBackend>) {
  return authBackend === 'convex' || authBackend === 'dual'
}

async function loadConvexUserMetadata(
  userId: string,
  getConvexProfile: typeof getConvexDocumentByLegacyId
) {
  try {
    const authRow = (await getConvexProfile('supabase_auth_users', userId)) as
      | {
          user_metadata?: Record<string, unknown>
          raw_user_meta_data?: Record<string, unknown>
        }
      | null
    return authRow?.user_metadata ?? authRow?.raw_user_meta_data ?? {}
  } catch {
    return {}
  }
}
