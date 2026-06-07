import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConvexDocumentByLegacyId, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { getAuthBackend } from '@/lib/auth/convex-session'

export interface AuthUserProfile {
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

function profileFromUser(user: any): AuthUserProfile {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined

  return {
    email: user?.email || null,
    full_name:
      typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.name === 'string'
          ? metadata.name
          : null,
    avatar_url: typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null,
  }
}

/**
 * These helpers resolve Supabase Auth users (auth.users) via
 * supabaseAdmin.auth.admin.* In convex-only mode that data plane is unreachable
 * (every supabase call throws), so we read the mirrored `supabase_auth_users`
 * table instead. They are reachable in convex mode even though the team routes
 * inline their own replicas: e.g. the invitations GET list and the invitation
 * `accept` GET both call getAuthUserProfileById UNCONDITIONALLY (after their
 * convex/supabase if-else) to resolve the inviter's profile.
 *
 * Gate is true whenever the Supabase Auth admin API would be unreachable: the
 * auth backend is convex, OR either the invitations or role_permissions data
 * domains read from convex (the two domains whose routes call these helpers).
 */
function shouldReadAuthProfilesFromConvex(): boolean {
  return (
    getAuthBackend() === 'convex' ||
    shouldReturnConvexData('invitations') ||
    shouldReturnConvexData('role_permissions')
  )
}

type MirroredAuthUserRow = Record<string, any>

/**
 * Replicates profileFromUser() but reading from the mirrored supabase_auth_users
 * row (the same JSON-serialized auth user object: email + user_metadata, with
 * raw_user_meta_data as a fallback key used by some sync paths).
 */
function profileFromMirroredAuthUser(user: MirroredAuthUserRow | null | undefined): AuthUserProfile {
  const metadata = (user?.user_metadata ?? user?.raw_user_meta_data) as
    | Record<string, unknown>
    | undefined

  return {
    email: typeof user?.email === 'string' ? user.email : null,
    full_name:
      typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.name === 'string'
          ? metadata.name
          : null,
    avatar_url: typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null,
  }
}

export async function getAuthUserProfileById(userId: string): Promise<AuthUserProfile | null> {
  if (shouldReadAuthProfilesFromConvex()) {
    const row = (await getConvexDocumentByLegacyId(
      'supabase_auth_users',
      userId
    )) as MirroredAuthUserRow | null
    if (!row) return null
    return profileFromMirroredAuthUser(row)
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !data?.user) return null

  return profileFromUser(data.user)
}

export async function getAuthUserProfilesByIds(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  const profiles = new Map<string, AuthUserProfile>()

  if (uniqueIds.length === 0) return profiles

  if (shouldReadAuthProfilesFromConvex()) {
    // Single batch read of the mirrored auth table, then index by id (legacyId is
    // the Supabase UUID; some rows also expose it under `id`).
    const rows = (await listConvexTable('supabase_auth_users', 10000)) as MirroredAuthUserRow[]
    const byId = new Map<string, MirroredAuthUserRow>()
    for (const row of rows) {
      for (const candidate of [row.id, row.legacyId]) {
        if (candidate != null) byId.set(String(candidate), row)
      }
    }

    for (const userId of uniqueIds) {
      const row = byId.get(String(userId))
      if (row) profiles.set(userId, profileFromMirroredAuthUser(row))
    }

    return profiles
  }

  await Promise.all(
    uniqueIds.map(async (userId) => {
      const profile = await getAuthUserProfileById(userId)
      if (profile) profiles.set(userId, profile)
    })
  )

  return profiles
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  if (shouldReadAuthProfilesFromConvex()) {
    // Mirrored auth users live in supabase_auth_users; case-insensitive email match.
    const rows = (await listConvexTable('supabase_auth_users', 10000)) as MirroredAuthUserRow[]
    const match = rows.find(
      (row) => typeof row.email === 'string' && row.email.toLowerCase() === normalized
    )
    if (!match) return null
    const resolvedId = match.id ?? match.legacyId ?? null
    return resolvedId !== null && resolvedId !== undefined ? String(resolvedId) : null
  }

  const perPage = 1000
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized)
    if (match) return match.id
    if (data.users.length < perPage) return null
  }

  return null
}
