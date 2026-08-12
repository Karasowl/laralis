import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { createHash } from 'crypto'
import { api } from '@/convex/_generated/api'
import { encodeConvexValue, prepareConvexRow } from './legacy'

// String-based reference so this typechecks before `convex/_generated/api` includes
// the authMigration module (the operator deploys it with the Convex Auth schema).
const currentUserLegacyIdRef = makeFunctionReference<'query'>('authMigration:currentUserLegacyId')

export { getLegacyIdForTable, prepareConvexRow, decodeConvexValue } from './legacy'

let client: ConvexHttpClient | null = null
let clientUrl: string | null = null

export function getConvexHttpClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

  if (!convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is required to use Convex server queries')
  }

  if (!client || clientUrl !== convexUrl) {
    client = new ConvexHttpClient(convexUrl, {
      fetch: noStoreFetch,
      logger: false,
    })
    clientUrl = convexUrl
  }

  return client
}

export function getConvexUrlHostForDiagnostics() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null

  try {
    return new URL(convexUrl).host
  } catch {
    return 'invalid-convex-url'
  }
}

function noStoreFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  return fetch(input, {
    ...init,
    cache: 'no-store',
    headers: {
      ...headersToObject(init?.headers),
      'cache-control': 'no-cache',
    },
  } as RequestInit)
}

function headersToObject(headers: HeadersInit | undefined) {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return headers
}

export async function getConvexTableCounts(tables?: string[]) {
  return getConvexHttpClient().query(api.migration.tableCounts, {
    secret: getConvexBridgeSecret(),
    tables,
  })
}

/**
 * Convex port of the Postgres RPC process_recurring_expenses. Generates due
 * recurring expenses and advances templates. Only call this on the Convex-only
 * write path (DATA_WRITE_MODE_EXPENSES=convex); in 'dual' the Supabase RPC +
 * runtime mirror already do the work.
 */
export async function processConvexRecurringExpenses(
  clinicId: string | null,
  today?: string
): Promise<{ generated_count: number; clinic_id: string | null; expense_ids: string[] }> {
  return getConvexHttpClient().mutation(api.recurringExpenses.processDue, {
    secret: getConvexBridgeSecret(),
    clinicId,
    today,
  })
}

export async function checkConvexMutationSecret() {
  return getConvexHttpClient().mutation(api.migration.checkSecret, {
    secret: getConvexBridgeSecret(),
  })
}

export async function getConvexDocumentByLegacyId(table: string, legacyId: string) {
  return getConvexHttpClient().query(api.migration.findByLegacyId, {
    secret: getConvexBridgeSecret(),
    table,
    legacyId,
  })
}

export async function listConvexDocumentsByClinic(table: string, clinicId: string, limit = 10000) {
  return getConvexHttpClient().query(api.migration.listByClinic, {
    secret: getConvexBridgeSecret(),
    table,
    clinicId,
    limit,
  })
}

export async function getConvexTreatmentsPage(args: {
  clinicId: string
  page: number
  pageSize: number
  patientId?: string
  dateFrom?: string
  dateTo?: string
  statuses?: string[]
  serviceIds?: string[]
  patientIds?: string[]
  priceFrom?: number
  priceTo?: number
  hasBalance?: boolean
  typeFilter?: 'all' | 'appointments' | 'treatments'
  today: string
  search?: string
}) {
  return getConvexHttpClient().query(api.migration.treatmentsPageByClinic, {
    secret: getConvexBridgeSecret(),
    ...args,
  })
}

export async function listConvexTable(table: string, limit = 10000) {
  return getConvexHttpClient().query(api.migration.listTable, {
    secret: getConvexBridgeSecret(),
    table,
    limit,
  })
}

export async function listConvexDocumentsByWorkspace(table: string, workspaceId: string, limit = 10000) {
  return getConvexHttpClient().query(api.migration.listByWorkspace, {
    secret: getConvexBridgeSecret(),
    table,
    workspaceId,
    limit,
  })
}

export async function getConvexAuthContext(userId: string) {
  const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!secret) throw new Error('CONVEX_AUTH_BRIDGE_SECRET is required')

  return getConvexHttpClient().query(api.authBridge.contextForUser, { secret, userId })
}

export async function getConvexAuthCredentialStats() {
  const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!secret) throw new Error('CONVEX_AUTH_BRIDGE_SECRET is required')

  return getConvexHttpClient().query(api.authBridge.credentialStats, { secret })
}

export async function createConvexPasswordReset(params: {
  email: string
  tokenHash: string
  expiresAt: string
  createdBy?: string
}) {
  return getConvexHttpClient().mutation(api.authBridge.createPasswordResetToken, {
    secret: getConvexBridgeSecret(),
    ...params,
  })
}

export async function verifyConvexPasswordReset(tokenHash: string) {
  return getConvexHttpClient().query(api.authBridge.verifyPasswordResetToken, {
    secret: getConvexBridgeSecret(),
    tokenHash,
  })
}

export async function consumeConvexPasswordReset(params: {
  tokenHash: string
  passwordHash: string
  passwordSalt: string
  algorithm: string
}) {
  return getConvexHttpClient().mutation(api.authBridge.consumePasswordResetToken, {
    secret: getConvexBridgeSecret(),
    ...params,
  })
}

export async function convexUserHasPermission(userId: string, clinicId: string, permission: string) {
  const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!secret) throw new Error('CONVEX_AUTH_BRIDGE_SECRET is required')

  return getConvexHttpClient().query(api.authBridge.userHasPermission, {
    secret,
    userId,
    clinicId,
    permission,
  })
}

export async function convexUserHasClinicAccess(userId: string, clinicId: string) {
  const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!secret) throw new Error('CONVEX_AUTH_BRIDGE_SECRET is required')

  return getConvexHttpClient().query(api.authBridge.userHasClinicAccess, {
    secret,
    userId,
    clinicId,
  })
}

/**
 * Convex parity for the Supabase active-workspace-membership access check:
 *   supabaseAdmin.from('workspace_users')
 *     .eq('workspace_id', workspaceId).eq('user_id', userId).eq('is_active', true).single()
 * Returns true when the user holds an active workspace_users membership in the workspace.
 * Used by the convex-only authorization branches of team/clinic-members,
 * team/workspace-members and invitations, where the Convex bridge has no RLS so the
 * caller's access check must be replicated before the data read. The predicate is strict
 * `is_active === true` to match the Supabase access gate `.eq('is_active', true)` exactly —
 * an authorization gate must not grant access the Supabase path would deny.
 */
export async function userHasActiveWorkspaceMembershipFromConvex(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const rows = (await listConvexDocumentsByWorkspace('workspace_users', workspaceId)) as Array<
    Record<string, any>
  >
  return rows.some(
    (row) =>
      String(row.workspace_id) === String(workspaceId) &&
      String(row.user_id) === String(userId) &&
      row.is_active === true
  )
}

/**
 * Resolve the application user id of the currently-authenticated Convex Auth user
 * by reading the @convex-dev/auth token and querying authMigration:currentUserLegacyId.
 * Migrated users retain their Supabase UUID. Native Convex registrations use the
 * Convex user id embedded in the already-verified access token.
 * Meaningful under AUTH_BACKEND=convex or dual. Callers gate on Convex auth being
 * enabled. The dynamic import keeps @convex-dev/auth out of the Supabase-only graph.
 */
export async function getConvexAuthUserLegacyId(): Promise<{
  legacyId: string | null
  email: string | null
} | null> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) return null
  const { convexAuthNextjsToken } = await import('@convex-dev/auth/nextjs/server')
  const token = await convexAuthNextjsToken()
  if (!token) return null
  const client = new ConvexHttpClient(convexUrl, { fetch: noStoreFetch, logger: false })
  client.setAuth(token)
  const result = (await client.query(currentUserLegacyIdRef, {})) as {
    legacyId: string | null
    email: string | null
  } | null
  if (!result) return null
  return {
    legacyId: result.legacyId ?? extractConvexAuthUserId(token),
    email: result.email,
  }
}

export function extractConvexAuthUserId(token: string): string | null {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { sub?: unknown }
    if (typeof payload.sub !== 'string') return null
    const userId = payload.sub.split('|')[0]
    return userId || null
  } catch {
    return null
  }
}

/**
 * Convex port of the Postgres RPC check_booking_slot_availability. PUBLIC query
 * (no secret) matching the SQL function's anon GRANT — public booking is
 * unauthenticated. Returns true when the candidate slot is free.
 */
export async function convexCheckSlotAvailable(params: {
  clinicId: string
  date: string
  time: string
  durationMinutes: number
}): Promise<boolean> {
  const result = await getConvexHttpClient().query(api.bookingAvailability.checkSlotAvailable, {
    clinicId: params.clinicId,
    date: params.date,
    time: params.time,
    durationMinutes: params.durationMinutes,
  })
  return Boolean(result)
}

/**
 * The shared Next.js <-> Convex server secret. Server-only: the variable has no
 * NEXT_PUBLIC_ prefix, so it never reaches the browser bundle. Reads use it too
 * (not just writes) since the mirror queries became secret-gated, hence the name.
 */
function getConvexBridgeSecret() {
  const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!secret) throw new Error('CONVEX_AUTH_BRIDGE_SECRET is required')
  return secret
}

export async function upsertConvexDocumentByLegacyId(table: string, legacyId: string, row: Record<string, unknown>) {
  return getConvexHttpClient().mutation(api.migration.upsertByLegacyId, {
    secret: getConvexBridgeSecret(),
    table,
    legacyId,
    row: prepareConvexRow(row, table, legacyId),
  })
}

export async function replaceConvexTableSnapshot(table: string, rows: Array<Record<string, unknown>>, source?: string) {
  return getConvexHttpClient().mutation(api.migration.replaceTableSnapshot, {
    secret: getConvexBridgeSecret(),
    table,
    rows: rows.map((row) => prepareConvexRow(row, table)),
    source,
  })
}

export async function patchConvexDocumentByLegacyId(table: string, legacyId: string, patch: Record<string, unknown>) {
  return getConvexHttpClient().mutation(api.migration.patchByLegacyId, {
    secret: getConvexBridgeSecret(),
    table,
    legacyId,
    patch: encodeConvexValue(patch) as Record<string, unknown>,
  })
}

export async function deleteConvexDocumentByLegacyId(table: string, legacyId: string) {
  return getConvexHttpClient().mutation(api.migration.deleteByLegacyId, {
    secret: getConvexBridgeSecret(),
    table,
    legacyId,
  })
}

export async function uploadConvexStorageObject(params: {
  bucket: string
  path: string
  data: Uint8Array | string
  contentType?: string
  source?: string
}) {
  const bytes = typeof params.data === 'string' ? new TextEncoder().encode(params.data) : params.data
  const uploadUrl = await getConvexHttpClient().mutation(api.migration.generateStorageUploadUrl, {
    secret: getConvexBridgeSecret(),
  })

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': params.contentType ?? 'application/octet-stream' },
    body: bytes as BodyInit,
  })

  if (!response.ok) {
    throw new Error(`Convex storage upload failed: ${response.status} ${response.statusText}`)
  }

  const { storageId } = (await response.json()) as { storageId?: string }
  if (!storageId) {
    throw new Error('Convex storage upload did not return storageId')
  }

  return getConvexHttpClient().mutation(api.migration.recordStorageObject, {
    secret: getConvexBridgeSecret(),
    bucket: params.bucket,
    path: params.path,
    storageId,
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType: params.contentType ?? 'application/octet-stream',
    source: params.source ?? 'runtime-mirror',
  })
}

export async function deleteConvexStorageObject(bucket: string, path: string) {
  return getConvexHttpClient().mutation(api.migration.deleteStorageObject, {
    secret: getConvexBridgeSecret(),
    bucket,
    path,
  })
}

/**
 * Resolve the short-lived download URL for a mirrored blob and return its bytes.
 * Returns null when the object is not in Convex storage (so the caller can fall
 * back to Supabase). Throws only when an EXISTING object's URL fetch fails.
 */
export async function downloadConvexStorageObject(
  bucket: string,
  path: string
): Promise<Uint8Array | null> {
  const result = await getConvexHttpClient().query(api.migration.getStorageObjectUrl, {
    secret: getConvexBridgeSecret(),
    bucket,
    path,
  })
  if (!result?.url) return null
  const response = await fetch(result.url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Convex storage download failed: ${response.status} ${response.statusText}`)
  }
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

/**
 * Resolve the short-lived download URL for a mirrored blob (without fetching bytes).
 * Returns null when the object is not in Convex storage.
 */
export async function getConvexStorageObjectUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const result = await getConvexHttpClient().query(api.migration.getStorageObjectUrl, {
    secret: getConvexBridgeSecret(),
    bucket,
    path,
  })
  return result?.url ?? null
}
