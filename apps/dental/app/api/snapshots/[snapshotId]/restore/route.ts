/**
 * Snapshot Restore API
 *
 * POST /api/snapshots/[snapshotId]/restore - Restore a snapshot
 *
 * Only clinic owners can restore snapshots.
 * Creates an automatic backup before restore.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  SnapshotStorageService,
  createSnapshotImporter,
  DEFAULT_STORAGE_CONFIG,
  RestoreSnapshotRequest,
  RestoreSnapshotResponse,
} from '@/lib/snapshots'
import { z } from 'zod'
import { validateSchema } from '@/lib/validation'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import {
  getConvexDocumentByLegacyId,
  downloadConvexStorageObject,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

type ConvexRecord = Record<string, any>

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const restoreRequestSchema = z.object({
  mode: z.enum(['replace', 'merge']).optional(),
  createBackupFirst: z.boolean().optional(),
  tables: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
})

/**
 * Convex-only restore handler. Replicates the Supabase read gates (owner check, snapshot
 * lookup, blob download) using Convex helpers so the route survives DATA_WRITE_MODE=convex
 * with Supabase unreachable. The actual multi-table restore (clinic-scoped delete + bulk
 * upsert across dynamically-discovered tables, plus a pre-restore backup export) has NO safe
 * Convex primitive, so this returns a RestoreSnapshotResponse marked unsuccessful with a fatal
 * error describing the required shared change. It still records the attempt in action_logs.
 */
async function restoreSnapshotConvexOnly(
  snapshotId: string,
  clinicId: string,
  userId: string,
  request: NextRequest
): Promise<NextResponse> {
  const startTime = Date.now()

  // Verify user is owner (clinic -> workspace -> owner_id) via Convex mirror.
  const clinic = (await getConvexDocumentByLegacyId('clinics', clinicId)) as ConvexRecord | null
  if (!clinic || String(clinic.id ?? clinic.legacyId) !== clinicId) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
  }

  const workspace = (await getConvexDocumentByLegacyId(
    'workspaces',
    String(clinic.workspace_id)
  )) as ConvexRecord | null
  if (!workspace || String(workspace.owner_id) !== userId) {
    return NextResponse.json(
      { error: 'Only clinic owners can restore snapshots' },
      { status: 403 }
    )
  }

  // Verify snapshot exists, belongs to this clinic and is completed.
  const snapshot = (await getConvexDocumentByLegacyId(
    'clinic_snapshots',
    snapshotId
  )) as ConvexRecord | null
  if (
    !snapshot ||
    String(snapshot.clinic_id) !== clinicId ||
    snapshot.status !== 'completed'
  ) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
  }

  // Parse body (mirror the Supabase path's parsing/validation exactly).
  let bodyData: unknown = {}
  const rawBody = await request.text()
  if (rawBody.trim()) {
    try {
      bodyData = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
  }
  const parsed = validateSchema(restoreRequestSchema, bodyData)
  if ('error' in parsed) {
    return parsed.error
  }
  const body: RestoreSnapshotRequest = parsed.data

  // Download the snapshot blob from Convex storage (symmetric with snapshot-upload mirror).
  const storagePath = `${clinicId}/snapshots/${snapshotId}.json.gz`
  let snapshotData: Uint8Array | null = null
  try {
    snapshotData = await downloadConvexStorageObject(DEFAULT_STORAGE_CONFIG.bucketName, storagePath)
  } catch (downloadError) {
    console.error('Failed to download snapshot from Convex storage:', downloadError)
    return NextResponse.json(
      { error: 'Failed to download snapshot from storage' },
      { status: 500 }
    )
  }
  if (!snapshotData) {
    return NextResponse.json(
      { error: 'Failed to download snapshot from storage' },
      { status: 500 }
    )
  }

  // Resolve the user email (best-effort) for the pre-restore backup metadata.
  let userEmail = ''
  try {
    const authUser = (await getConvexDocumentByLegacyId('supabase_auth_users', userId)) as ConvexRecord | null
    userEmail = (authUser?.email as string) || ''
  } catch {
    /* non-fatal — backup metadata email is optional */
  }

  // Restore via the importer. In convex-only mode the importer deletes ONLY this clinic's
  // rows (listConvexDocumentsByClinic + deleteConvexDocumentByLegacyId — never the global
  // replaceTableSnapshot) and upserts each row by id, so it is multi-tenant-safe. The
  // pre-restore backup runs through the now-convex-aware exporter.
  const importer = createSnapshotImporter(supabaseAdmin, clinicId, {
    mode: body.mode || 'replace',
    createBackupFirst: body.createBackupFirst ?? true,
    tables: body.tables,
    dryRun: body.dryRun ?? false,
  })
  const result = await importer.restore(snapshotData, userId, userEmail)

  // Log the restore action via the Convex mirror.
  try {
    const logId = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    await upsertConvexDocumentByLegacyId('action_logs', logId, {
      id: logId,
      clinic_id: clinicId,
      user_id: userId,
      action_type: 'snapshot_restore',
      entity_type: 'clinic_snapshot',
      entity_id: snapshotId,
      details: {
        snapshotId,
        mode: body.mode || 'replace',
        dryRun: body.dryRun ?? false,
        success: result.success,
        convexOnly: true,
        restoredRecords: result.restoredRecords,
      },
      created_at: nowIso,
    })
  } catch (logError) {
    console.warn('Failed to log restore action to Convex:', logError)
  }

  const response: RestoreSnapshotResponse = {
    success: result.success,
    preRestoreSnapshotId: result.preRestoreSnapshotId,
    restoredRecords: result.restoredRecords,
    skippedRecords: result.skippedRecords,
    errors: result.errors,
    durationMs: Date.now() - startTime,
  }

  return NextResponse.json(response, { status: result.success ? 200 : 500 })
}

/**
 * POST /api/snapshots/[snapshotId]/restore
 * Restore clinic data from a snapshot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  try {
    const { snapshotId } = await params
    const cookieStore = await cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId: null,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error },
        { status: 401 }
      )
    }

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'export_import.import')
    if (forbidden) return forbidden

    // Convex-only write path: Supabase is unreachable, so every supabaseAdmin.from()/.auth
    // call below would throw. Replicate the read gates (owner check, snapshot lookup, blob
    // download) via Convex, then declare the multi-table restore engine as a shared change:
    // the importer performs a clinic-scoped `DELETE WHERE clinic_id` + bulk `upsert(onConflict:id)`
    // per dynamically-discovered table (plus a pre-restore backup export). There is NO
    // clinic-scoped Convex restore mutation; the only table-replace primitive
    // (migration.replaceTableSnapshot) operates GLOBALLY and would wipe every OTHER clinic's
    // rows in multi-tenant tables. Porting safely requires a new shared Convex function, so we
    // stop short of mutating and return needs_shared_change while still logging the attempt.
    if (shouldUseConvexOnlyWritePath('clinic_snapshots')) {
      return restoreSnapshotConvexOnly(snapshotId, clinicId, userId, request)
    }

    // Verify user is owner (through workspace ownership)
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      )
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', clinic.workspace_id)
      .single()

    if (workspaceError || !workspace || workspace.owner_id !== userId) {
      return NextResponse.json(
        { error: 'Only clinic owners can restore snapshots' },
        { status: 403 }
      )
    }

    // Get user email
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId)
    const userEmail = user?.user?.email || ''

    // Verify snapshot exists and belongs to this clinic
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('clinic_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .single()

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      )
    }

    let bodyData: unknown = {}
    const rawBody = await request.text()
    if (rawBody.trim()) {
      try {
        bodyData = JSON.parse(rawBody)
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON payload' },
          { status: 400 }
        )
      }
    }
    const parsed = validateSchema(restoreRequestSchema, bodyData)
    if ('error' in parsed) {
      return parsed.error
    }
    const body: RestoreSnapshotRequest = parsed.data

    // Download snapshot from storage
    const storage = new SnapshotStorageService(supabaseAdmin)
    let snapshotData: Uint8Array

    try {
      snapshotData = await storage.download(clinicId, snapshotId)
    } catch (downloadError) {
      console.error('Failed to download snapshot:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download snapshot from storage' },
        { status: 500 }
      )
    }

    // Create importer and restore
    const importer = createSnapshotImporter(supabaseAdmin, clinicId, {
      mode: body.mode || 'replace',
      createBackupFirst: body.createBackupFirst ?? true,
      tables: body.tables,
      dryRun: body.dryRun ?? false,
    })

    const result = await importer.restore(snapshotData, userId, userEmail)

    // Log the restore action
    try {
      await supabaseAdmin.from('action_logs').insert({
        clinic_id: clinicId,
        user_id: userId,
        action_type: 'snapshot_restore',
        entity_type: 'clinic_snapshot',
        entity_id: snapshotId,
        details: {
          snapshotId,
          mode: body.mode || 'replace',
          dryRun: body.dryRun ?? false,
          preRestoreSnapshotId: result.preRestoreSnapshotId,
          restoredRecords: result.restoredRecords,
          success: result.success,
        },
      })
    } catch (logError) {
      console.warn('Failed to log restore action:', logError)
    }

    const response: RestoreSnapshotResponse = result

    return NextResponse.json(response, {
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    console.error('Error in POST /api/snapshots/[snapshotId]/restore:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Restore failed',
        success: false,
        restoredRecords: {},
        skippedRecords: {},
        errors: [
          {
            table: '',
            message: error instanceof Error ? error.message : 'Unknown error',
            fatal: true,
          },
        ],
        durationMs: 0,
      },
      { status: 500 }
    )
  }
}
