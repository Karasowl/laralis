import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'
import { MIRRORED_TABLE_NAMES } from './mirroredTables'

/**
 * Convex Auth (@convex-dev/auth) schema + indexed mirror tables.
 *
 * `schemaValidation: false` is deliberate and load-bearing: the ~60 mirror tables
 * are written schemalessly (each row carries the full Supabase column set, varying
 * per table). With validation OFF, declaring a table with a MINIMAL validator
 * (only the indexed join-key columns) + indexes does NOT reject the existing wide
 * rows — it only ADDS the indexes. This turns every Convex read from a full-table
 * `.collect()` scan into an indexed lookup (by clinic_id / workspace_id / legacyId),
 * which is the dominant cost of serving the app from Convex.
 *
 * The index field set is uniform across all mirror tables so migration.ts can use
 * any of the three on any table without a per-table mismatch (a mismatch would make
 * `.withIndex()` throw). Tables lacking a column (e.g. workspaces has no clinic_id)
 * simply index `undefined`, which never matches a real query — harmless.
 *
 * authTables adds: users, authAccounts, authSessions, authRefreshTokens,
 * authVerificationCodes, authVerifiers, authRateLimits.
 */
function mirrorTable() {
  return defineTable({
    legacyId: v.optional(v.string()),
    clinic_id: v.optional(v.string()),
    workspace_id: v.optional(v.string()),
  })
    .index('by_legacyId', ['legacyId'])
    .index('by_clinic', ['clinic_id'])
    .index('by_workspace', ['workspace_id'])
}

const mirrorTables = Object.fromEntries(
  MIRRORED_TABLE_NAMES.map((name) => [name, mirrorTable()])
)

export default defineSchema(
  {
    ...authTables,
    ...mirrorTables,
  },
  { schemaValidation: false }
)
