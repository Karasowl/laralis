import { defineSchema } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'

/**
 * Convex Auth (@convex-dev/auth) schema.
 *
 * IMPORTANT: only spread `authTables`. Do NOT declare the ~60 mirrored Supabase
 * tables here — they are written schemalessly by migration.ts / authBridge.ts and
 * adding strict definitions would reject existing rows.
 *
 * `schemaValidation: false` is deliberate and load-bearing: the deployment already
 * holds ~60 untyped mirror tables. With validation OFF, declaring the auth tables
 * only ADDS typed tables + indexes; the existing untyped mirror tables are never
 * validated or rejected on push. This is the single safest choice for a mixed
 * (typed auth + untyped mirror) deployment.
 *
 * authTables adds: users, authAccounts, authSessions, authRefreshTokens,
 * authVerificationCodes, authVerifiers, authRateLimits.
 */
export default defineSchema(
  {
    ...authTables,
  },
  { schemaValidation: false }
)
