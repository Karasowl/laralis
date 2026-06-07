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
  return getConvexHttpClient().query(api.migration.tableCounts, { tables })
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
    secret: getConvexMutationSecret(),
    clinicId,
    today,
  })
}

export async function checkConvexMutationSecret() {
  return getConvexHttpClient().mutation(api.migration.checkSecret, {
    secret: getConvexMutationSecret(),
  })
}

export async function getConvexDocumentByLegacyId(table: string, legacyId: string) {
  return getConvexHttpClient().query(api.migration.findByLegacyId, { table, legacyId })
}

export async function listConvexDocumentsByClinic(table: string, clinicId: string, limit = 10000) {
  return getConvexHttpClient().query(api.migration.listByClinic, { table, clinicId, limit })
}

export async function listConvexTable(table: string, limit = 10000) {
  return getConvexHttpClient().query(api.migration.listTable, { table, limit })
}

export async function listConvexDocumentsByWorkspace(table: string, workspaceId: string, limit = 10000) {
  return getConvexHttpClient().query(api.migration.listByWorkspace, { table, workspaceId, limit })
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
    secret: getConvexMutationSecret(),
    ...params,
  })
}

export async function verifyConvexPasswordReset(tokenHash: string) {
  return getConvexHttpClient().query(api.authBridge.verifyPasswordResetToken, {
    secret: getConvexMutationSecret(),
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
    secret: getConvexMutationSecret(),
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
 * Resolve the Supabase UUID (legacyId) of the currently-authenticated Convex Auth
 * user by reading the @convex-dev/auth token and querying
 * authMigration:currentUserLegacyId. Returns null when not signed in via Convex Auth.
 * Only meaningful under AUTH_BACKEND=convex; callers gate on that. The dynamic import
 * keeps @convex-dev/auth out of the Supabase-mode module graph.
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
  return result ?? null
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

function getConvexMutationSecret() {
  const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!secret) throw new Error('CONVEX_AUTH_BRIDGE_SECRET is required')
  return secret
}

export async function upsertConvexDocumentByLegacyId(table: string, legacyId: string, row: Record<string, unknown>) {
  return getConvexHttpClient().mutation(api.migration.upsertByLegacyId, {
    secret: getConvexMutationSecret(),
    table,
    legacyId,
    row: prepareConvexRow(row, table, legacyId),
  })
}

export async function replaceConvexTableSnapshot(table: string, rows: Array<Record<string, unknown>>, source?: string) {
  return getConvexHttpClient().mutation(api.migration.replaceTableSnapshot, {
    secret: getConvexMutationSecret(),
    table,
    rows: rows.map((row) => prepareConvexRow(row, table)),
    source,
  })
}

export async function patchConvexDocumentByLegacyId(table: string, legacyId: string, patch: Record<string, unknown>) {
  return getConvexHttpClient().mutation(api.migration.patchByLegacyId, {
    secret: getConvexMutationSecret(),
    table,
    legacyId,
    patch: encodeConvexValue(patch) as Record<string, unknown>,
  })
}

export async function deleteConvexDocumentByLegacyId(table: string, legacyId: string) {
  return getConvexHttpClient().mutation(api.migration.deleteByLegacyId, {
    secret: getConvexMutationSecret(),
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
    secret: getConvexMutationSecret(),
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
    secret: getConvexMutationSecret(),
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
    secret: getConvexMutationSecret(),
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
    bucket,
    path,
  })
  return result?.url ?? null
}
