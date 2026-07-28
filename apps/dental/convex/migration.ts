import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { MIRRORED_TABLE_NAMES } from './mirroredTables'

const MIGRATED_TABLES = MIRRORED_TABLE_NAMES

// Every migrated table is declared in schema.ts with the uniform by_legacyId /
// by_clinic / by_workspace indexes, so any of those may be used on any table.
const INDEXED_TABLES = new Set<string>(MIRRORED_TABLE_NAMES)

type ImportedDocument = Record<string, unknown>

function assertMigrationSecret(secret: string | undefined) {
  const expected = process.env.CONVEX_AUTH_BRIDGE_SECRET
  if (!expected || secret !== expected) {
    throw new Error('Unauthorized Convex migration request')
  }
}

/**
 * Read-path authorization for the mirror queries.
 *
 * These queries used to be fully public. A Convex `query` export is callable by
 * ANYONE who knows the deployment URL, and that URL ships to the browser as
 * NEXT_PUBLIC_CONVEX_URL, so `listTable({table:'patients'})` was an unauthenticated
 * dump of every mirrored table. All app reads go through the Next.js server
 * (lib/convex/server.ts), never from the browser, so requiring the shared
 * server secret closes that hole without touching the UI.
 *
 * `secret` stays OPTIONAL in the args validator on purpose: Convex rejects
 * undeclared arguments, so a required arg would break every in-flight request
 * from the previous Next.js build the instant this deploys. Enforcement is
 * gated on CONVEX_QUERY_SECRET_ENFORCED instead, which lets the rollout be:
 *
 *   1. deploy Convex (open, nothing breaks)
 *   2. deploy Next.js (now sends the secret, nothing breaks)
 *   3. `npx convex env set CONVEX_QUERY_SECRET_ENFORCED 1` (hole closed, no redeploy)
 *
 * Step 3 is instant and reversible with `npx convex env remove ...`, which is the
 * emergency rollback if a caller was missed. Once this has been enforced in
 * production for a while, drop the flag and call assertMigrationSecret directly.
 */
function assertQueryAuth(secret: string | undefined) {
  if (process.env.CONVEX_QUERY_SECRET_ENFORCED !== '1') return
  assertMigrationSecret(secret)
}

function assertMigratedTable(table: string) {
  if (!MIGRATED_TABLES.includes(table as (typeof MIGRATED_TABLES)[number])) {
    throw new Error(`Unsupported Convex migration table: ${table}`)
  }
}

function getDocumentLegacyId(doc: ImportedDocument) {
  const legacyId = doc.legacyId ?? doc.id
  if (legacyId === undefined || legacyId === null) return null
  return String(legacyId)
}

function documentsMatchSnapshot(existing: ImportedDocument, incoming: ImportedDocument) {
  return stableStringify(stripSnapshotMetadata(existing)) === stableStringify(stripSnapshotMetadata(incoming))
}

function stripSnapshotMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripSnapshotMetadata(item))

  if (value && typeof value === 'object') {
    const object: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (
        key === '_id' ||
        key === '_creationTime' ||
        key === 'convex_created_at' ||
        key === 'convex_updated_at' ||
        key === 'convex_snapshot_source'
      ) {
        continue
      }
      object[key] = stripSnapshotMetadata(child)
    }
    return object
  }

  return value
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function findDocumentByLegacyId(ctx: any, table: string, legacyId: string) {
  assertMigratedTable(table)
  if (INDEXED_TABLES.has(table)) {
    // Indexed lookup — every mirror row is written with legacyId set, so this hits
    // the by_legacyId index instead of scanning the whole table.
    const doc = await ctx.db
      .query(table as any)
      .withIndex('by_legacyId', (q: any) => q.eq('legacyId', legacyId))
      .first()
    if (doc) return doc as ImportedDocument & { _id: any }
    // Safety net for any pre-index row that stored the uuid only in `id`.
  }
  const docs = (await ctx.db.query(table as any).collect()) as Array<ImportedDocument & { _id: any }>
  return docs.find((doc) => doc.legacyId === legacyId || doc.id === legacyId) ?? null
}

export const tableCounts = query({
  args: {
    secret: v.optional(v.string()),
    tables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const tables = args.tables ?? [...MIGRATED_TABLES]
    const entries: Array<[string, number]> = []

    for (const table of tables) {
      const docs = await ctx.db.query(table as any).collect()
      entries.push([table, docs.length])
    }

    return Object.fromEntries(entries)
  },
})

export const checkSecret = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (_ctx, args) => {
    assertMigrationSecret(args.secret)
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
    }
  },
})

export const clearTable = mutation({
  args: {
    secret: v.string(),
    table: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)
    assertMigratedTable(args.table)

    const docs = (await ctx.db.query(args.table as any).collect()) as Array<{ _id: any }>
    for (const doc of docs) {
      await ctx.db.delete(doc._id)
    }

    return { table: args.table, deleted: docs.length }
  },
})

export const findByLegacyId = query({
  args: {
    secret: v.optional(v.string()),
    table: v.string(),
    legacyId: v.string(),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    return findDocumentByLegacyId(ctx, args.table, args.legacyId)
  },
})

export const listByClinic = query({
  args: {
    secret: v.optional(v.string()),
    table: v.string(),
    clinicId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const limit = Math.max(1, Math.min(args.limit ?? 1000, 10000))

    if (INDEXED_TABLES.has(args.table)) {
      // Indexed by clinic_id — returns only this clinic's rows instead of scanning
      // the whole table. The mirror stores the Supabase column `clinic_id`.
      return (await ctx.db
        .query(args.table as any)
        .withIndex('by_clinic', (q: any) => q.eq('clinic_id', args.clinicId))
        .take(limit)) as ImportedDocument[]
    }

    const docs = (await ctx.db.query(args.table as any).collect()) as ImportedDocument[]
    return docs
      .filter((doc) => doc.clinic_id === args.clinicId || doc.clinicId === args.clinicId)
      .slice(0, limit)
  },
})

export const listTable = query({
  args: {
    secret: v.optional(v.string()),
    table: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const limit = Math.max(1, Math.min(args.limit ?? 1000, 10000))
    const docs = (await ctx.db.query(args.table as any).collect()) as ImportedDocument[]

    return docs.slice(0, limit)
  },
})

export const listByWorkspace = query({
  args: {
    secret: v.optional(v.string()),
    table: v.string(),
    workspaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const limit = Math.max(1, Math.min(args.limit ?? 1000, 10000))

    if (INDEXED_TABLES.has(args.table)) {
      // Indexed by workspace_id instead of scanning the whole table.
      return (await ctx.db
        .query(args.table as any)
        .withIndex('by_workspace', (q: any) => q.eq('workspace_id', args.workspaceId))
        .take(limit)) as ImportedDocument[]
    }

    const docs = (await ctx.db.query(args.table as any).collect()) as ImportedDocument[]
    return docs
      .filter((doc) => doc.workspace_id === args.workspaceId || doc.workspaceId === args.workspaceId)
      .slice(0, limit)
  },
})

export const upsertByLegacyId = mutation({
  args: {
    secret: v.string(),
    table: v.string(),
    legacyId: v.string(),
    row: v.any(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)
    assertMigratedTable(args.table)

    const now = new Date().toISOString()
    const existing = await findDocumentByLegacyId(ctx, args.table, args.legacyId)
    const row = {
      ...args.row,
      id: args.row?.id ?? args.legacyId,
      legacyId: args.legacyId,
      legacyTable: args.table,
      convex_updated_at: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, row)
      return { legacyId: args.legacyId, id: existing._id, updated: true }
    }

    const id = await ctx.db.insert(args.table as any, {
      ...row,
      convex_created_at: now,
    })
    return { legacyId: args.legacyId, id, updated: false }
  },
})

export const replaceTableSnapshot = mutation({
  args: {
    secret: v.string(),
    table: v.string(),
    rows: v.array(v.any()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)
    assertMigratedTable(args.table)

    const now = new Date().toISOString()
    const existingDocs = (await ctx.db.query(args.table as any).collect()) as Array<
      ImportedDocument & { _id: any }
    >
    const existingByLegacyId = new Map<string, ImportedDocument & { _id: any }>()

    for (const doc of existingDocs) {
      const legacyId = getDocumentLegacyId(doc)
      if (legacyId && !existingByLegacyId.has(legacyId)) existingByLegacyId.set(legacyId, doc)
    }

    const incomingLegacyIds = new Set<string>()
    const retainedExistingIds = new Set<unknown>()
    let inserted = 0
    let updated = 0
    let unchanged = 0

    for (let index = 0; index < args.rows.length; index += 1) {
      const sourceRow = args.rows[index] as ImportedDocument
      const legacyId = getDocumentLegacyId(sourceRow) ?? `${args.table}:${index}`
      incomingLegacyIds.add(legacyId)

      const row = {
        ...sourceRow,
        id: sourceRow.id ?? legacyId,
        legacyId,
        legacyTable: args.table,
        convex_snapshot_source: args.source ?? 'supabase-full-sync',
        convex_updated_at: now,
      }
      const existing = existingByLegacyId.get(legacyId)

      if (existing) {
        retainedExistingIds.add(existing._id)
        if (documentsMatchSnapshot(existing, row)) {
          unchanged += 1
        } else {
          await ctx.db.replace(existing._id, {
            ...row,
            convex_created_at: existing.convex_created_at ?? now,
          } as any)
          updated += 1
        }
      } else {
        await ctx.db.insert(args.table as any, {
          ...row,
          convex_created_at: now,
        })
        inserted += 1
      }
    }

    let deleted = 0
    for (const doc of existingDocs) {
      const legacyId = getDocumentLegacyId(doc)
      if (!legacyId || !incomingLegacyIds.has(legacyId) || !retainedExistingIds.has(doc._id)) {
        await ctx.db.delete(doc._id)
        deleted += 1
      }
    }

    return {
      table: args.table,
      source: args.source ?? null,
      expectedRows: args.rows.length,
      inserted,
      updated,
      unchanged,
      deleted,
      finalRows: existingDocs.length + inserted - deleted,
    }
  },
})

export const patchByLegacyId = mutation({
  args: {
    secret: v.string(),
    table: v.string(),
    legacyId: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)
    assertMigratedTable(args.table)

    const existing = await findDocumentByLegacyId(ctx, args.table, args.legacyId)
    if (!existing) {
      return { legacyId: args.legacyId, updated: false, missing: true }
    }

    await ctx.db.patch(existing._id, {
      ...args.patch,
      convex_updated_at: new Date().toISOString(),
    })
    return { legacyId: args.legacyId, id: existing._id, updated: true, missing: false }
  },
})

export const deleteByLegacyId = mutation({
  args: {
    secret: v.string(),
    table: v.string(),
    legacyId: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)
    assertMigratedTable(args.table)

    const existing = await findDocumentByLegacyId(ctx, args.table, args.legacyId)
    if (!existing) {
      return { legacyId: args.legacyId, deleted: false, missing: true }
    }

    await ctx.db.delete(existing._id)
    return { legacyId: args.legacyId, deleted: true, missing: false }
  },
})

export const findStorageObject = query({
  args: {
    secret: v.optional(v.string()),
    bucket: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const docs = (await ctx.db.query('storage_objects' as any).collect()) as ImportedDocument[]
    return docs.find((doc) => doc.bucket === args.bucket && doc.path === args.path) ?? null
  },
})

// Resolve a stored blob's short-lived download URL by (bucket, path), mirroring
// findStorageObject. Returns null when the object is not mirrored so the Next.js
// caller can fall back to Supabase Storage. Secret-gated: this hands out a signed
// download URL, so leaving it open exposed every stored blob (snapshots, exports)
// to anyone who could guess a bucket/path pair.
export const getStorageObjectUrl = query({
  args: {
    secret: v.optional(v.string()),
    bucket: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const docs = (await ctx.db.query('storage_objects' as any).collect()) as ImportedDocument[]
    const existing = docs.find((doc) => doc.bucket === args.bucket && doc.path === args.path)
    if (!existing || typeof existing.storageId !== 'string') return null
    const url = await ctx.storage.getUrl(existing.storageId as any)
    if (!url) return null
    return {
      url,
      size: Number(existing.size ?? 0),
      contentType: String(existing.contentType ?? 'application/octet-stream'),
      sha256: existing.sha256 ?? null,
    }
  },
})

export const storageObjectStats = query({
  args: {
    secret: v.optional(v.string()),
    bucket: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const docs = (await ctx.db.query('storage_objects' as any).collect()) as ImportedDocument[]
    const filtered = args.bucket ? docs.filter((doc) => doc.bucket === args.bucket) : docs
    const bytes = filtered.reduce((sum, doc) => sum + Number(doc.size ?? 0), 0)

    return {
      files: filtered.length,
      bytes,
      buckets: Array.from(new Set(filtered.map((doc) => String(doc.bucket)))).sort(),
    }
  },
})

export const listStorageObjects = query({
  args: {
    secret: v.optional(v.string()),
    bucket: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertQueryAuth(args.secret)
    const limit = Math.max(1, Math.min(args.limit ?? 1000, 10000))
    const docs = (await ctx.db.query('storage_objects' as any).collect()) as ImportedDocument[]
    const filtered = args.bucket ? docs.filter((doc) => doc.bucket === args.bucket) : docs
    return filtered
      .sort((a, b) => String(a.path ?? '').localeCompare(String(b.path ?? '')))
      .slice(0, limit)
  },
})

export const clearStorageObjects = mutation({
  args: {
    secret: v.string(),
    bucket: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)

    const docs = (await ctx.db.query('storage_objects' as any).collect()) as Array<ImportedDocument & { _id: any }>
    const filtered = args.bucket ? docs.filter((doc) => doc.bucket === args.bucket) : docs
    let deletedFiles = 0

    for (const doc of filtered) {
      if (typeof doc.storageId === 'string') {
        try {
          await ctx.storage.delete(doc.storageId as any)
          deletedFiles += 1
        } catch {
          // Keep clearing metadata even if the blob was already removed.
        }
      }
      await ctx.db.delete(doc._id)
    }

    return { bucket: args.bucket ?? null, deletedMetadata: filtered.length, deletedFiles }
  },
})

export const generateStorageUploadUrl = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)
    return ctx.storage.generateUploadUrl()
  },
})

export const recordStorageObject = mutation({
  args: {
    secret: v.string(),
    bucket: v.string(),
    path: v.string(),
    storageId: v.string(),
    size: v.number(),
    sha256: v.optional(v.string()),
    contentType: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)

    const now = new Date().toISOString()
    const docs = (await ctx.db.query('storage_objects' as any).collect()) as Array<ImportedDocument & { _id: any }>
    const existing = docs.find((doc) => doc.bucket === args.bucket && doc.path === args.path)
    const row = {
      bucket: args.bucket,
      path: args.path,
      storageId: args.storageId,
      size: args.size,
      sha256: args.sha256 ?? null,
      contentType: args.contentType ?? 'application/octet-stream',
      source: args.source ?? 'supabase-storage-export',
      legacyId: `${args.bucket}/${args.path}`,
      legacyTable: 'storage_objects',
      convex_updated_at: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, row as any)
      return { path: args.path, id: existing._id, updated: true }
    }

    const id = await ctx.db.insert('storage_objects' as any, {
      ...row,
      convex_created_at: now,
    })
    return { path: args.path, id, updated: false }
  },
})

export const deleteStorageObject = mutation({
  args: {
    secret: v.string(),
    bucket: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret)

    const docs = (await ctx.db.query('storage_objects' as any).collect()) as Array<ImportedDocument & { _id: any }>
    const existing = docs.find((doc) => doc.bucket === args.bucket && doc.path === args.path)

    if (!existing) {
      return { path: args.path, deleted: false, missing: true }
    }

    if (typeof existing.storageId === 'string') {
      try {
        await ctx.storage.delete(existing.storageId as any)
      } catch {
        // Delete metadata even when the blob is already gone.
      }
    }

    await ctx.db.delete(existing._id)
    return { path: args.path, deleted: true, missing: false }
  },
})
