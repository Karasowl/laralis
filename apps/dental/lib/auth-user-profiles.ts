import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

export async function getAuthUserProfileById(userId: string): Promise<AuthUserProfile | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !data?.user) return null

  return profileFromUser(data.user)
}

export async function getAuthUserProfilesByIds(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  const profiles = new Map<string, AuthUserProfile>()

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
