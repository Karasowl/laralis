import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId } from '@convex-dev/auth/server'

/**
 * A4 — reset-on-cutover bridge between Supabase Auth identities and Convex Auth.
 *
 * The ENTIRE app keys identity off the Supabase auth UUID (workspaces.owner_id,
 * workspace_users.user_id, clinic_users.user_id, supabase_auth_users.legacyId, and
 * authBridge.getAuthContextForUser matching row.id===userId || row.legacyId===userId).
 * Convex Auth mints its own users._id (NOT a UUID). To keep every membership +
 * permission join working after cutover, we store the Supabase UUID as `legacyId`
 * on each Convex Auth users doc and translate token-subject -> UUID before any
 * authBridge query.
 *
 * Passwords are intentionally NOT migrated: the app's scrypt format and
 * @convex-dev/auth's @auth/core scrypt format are incompatible. Every user resets
 * their password on first Convex-auth login (ResendOTPPasswordReset). Document this
 * in the cutover runbook.
 *
 * All functions secret-gated; dormant until AUTH_BACKEND is flipped and invoked
 * manually with CONVEX_AUTH_BRIDGE_SECRET.
 */

type Doc = Record<string, any>

function assertSecret(secret: string) {
  const expected = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!expected || secret !== expected) {
    throw new Error('Unauthorized auth-migration request')
  }
}

/**
 * Pre-create Convex Auth `users` rows from the supabase_auth_users mirror,
 * preserving the Supabase UUID as `legacyId`. Idempotent: skips users already
 * seeded (matched by legacyId). Does NOT seed passwords.
 */
export const seedAuthUsersFromMirror = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret)

    const mirror = (await ctx.db.query('supabase_auth_users' as any).collect()) as Doc[]
    const existingUsers = (await ctx.db.query('users' as any).collect()) as Array<Doc & { _id: any }>

    const seenLegacy = new Set<string>()
    for (const u of existingUsers) {
      if (u.legacyId != null) seenLegacy.add(String(u.legacyId))
    }

    let created = 0
    let skipped = 0
    for (const row of mirror) {
      const uuid = String(row.legacyId ?? row.id ?? '')
      if (!uuid || seenLegacy.has(uuid)) {
        skipped++
        continue
      }
      const email = String(row.email ?? '').trim().toLowerCase()
      const meta = (row.user_metadata ?? row.raw_user_meta_data ?? {}) as Doc
      await ctx.db.insert('users' as any, {
        email: email || undefined,
        name: (meta?.full_name ?? meta?.name ?? undefined) as any,
        legacyId: uuid,
      })
      seenLegacy.add(uuid)
      created++
    }

    return { created, skipped, total: mirror.length }
  },
})

/**
 * TEST-ONLY (secret-gated): link a password authAccount (provider 'password',
 * providerAccountId = email, secret = pre-hashed) to the seeded user with that email,
 * marking emailVerified so sign-in works. Called by testHelpers.createTestPasswordAccount
 * (which does the Node scrypt hashing). Safe to delete after testing.
 */
export const linkPasswordAccount = mutation({
  args: { secret: v.string(), email: v.string(), hash: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret)
    const email = args.email.trim().toLowerCase()
    const users = (await ctx.db.query('users' as any).collect()) as Array<Doc & { _id: any }>
    const user = users.find((u) => String(u.email ?? '').trim().toLowerCase() === email)
    if (!user) throw new Error(`No seeded user for email: ${email}`)

    const accounts = (await ctx.db.query('authAccounts' as any).collect()) as Array<Doc & { _id: any }>
    const existing = accounts.find(
      (a) => a.provider === 'password' && String(a.providerAccountId).toLowerCase() === email
    )
    const now = new Date().toISOString()
    if (existing) {
      await ctx.db.patch(existing._id, { secret: args.hash, emailVerified: now } as any)
      return { updated: true, userId: String(user._id), legacyId: user.legacyId ?? null }
    }
    await ctx.db.insert('authAccounts' as any, {
      userId: user._id,
      provider: 'password',
      providerAccountId: email,
      secret: args.hash,
      emailVerified: now,
    } as any)
    return { created: true, userId: String(user._id), legacyId: user.legacyId ?? null }
  },
})

/**
 * Return the preserved Supabase UUID (legacyId) for the currently-authenticated
 * Convex Auth user. Called from the Next.js server (resolveClinicContext) with the
 * Convex Auth token set on the client, so getAuthUserId resolves the user. This is
 * the seam that maps the Convex token-subject back to the UUID every app join uses.
 */
export const currentUserLegacyId = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = (await ctx.db.get(userId)) as Doc | null
    if (!user) return null
    return {
      legacyId: user.legacyId != null ? String(user.legacyId) : null,
      email: user.email != null ? String(user.email) : null,
    }
  },
})
