/**
 * Individual Snapshot API
 *
 * GET /api/snapshots/[snapshotId] - Download a snapshot
 * DELETE /api/snapshots/[snapshotId] - Delete a snapshot
 *
 * Only clinic owners can manage snapshots.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SnapshotStorageService } from '@/lib/snapshots'
import { DEFAULT_STORAGE_CONFIG } from '@/lib/snapshots/types'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import {
  getConvexDocumentByLegacyId,
  deleteConvexDocumentByLegacyId,
  deleteConvexStorageObject,
  decodeConvexValue,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return decodeConvexValue(rest) as ImportedRecord
}

/**
 * GET /api/snapshots/[snapshotId]
 * Download a snapshot file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  try {
    const { snapshotId } = await params
    const cookieStore = await cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId: request.nextUrl.searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error },
        { status: 401 }
      )
    }

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'export_import.export')
    if (forbidden) return forbidden

    // Verify snapshot exists and belongs to this clinic. Flag-gated Convex branch
    // (default Supabase): clinic_snapshots is keyed by id, so fetch by legacy id and
    // re-check clinic ownership in JS (mirrors .eq('id').eq('clinic_id').single()).
    // The snapshot FILE itself is downloaded from Supabase Storage below regardless.
    let snapshot: ImportedRecord | null
    if (shouldReturnConvexData('clinic_snapshots')) {
      const doc = normalizeConvexRecord(await getConvexDocumentByLegacyId('clinic_snapshots', snapshotId) as ImportedRecord | null)
      snapshot = doc && String(doc.clinic_id) === String(clinicId) ? doc : null
    } else {
      const { data, error: snapshotError } = await supabaseAdmin
        .from('clinic_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .eq('clinic_id', clinicId)
        .single()

      if (snapshotError) {
        snapshot = null
      } else {
        snapshot = data
      }
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      )
    }

    // Check if user wants metadata only
    const metadataOnly = request.nextUrl.searchParams.get('metadata') === 'true'

    if (metadataOnly) {
      return NextResponse.json({
        id: snapshot.id,
        clinicId: snapshot.clinic_id,
        createdAt: snapshot.created_at,
        type: snapshot.type,
        status: snapshot.status,
        checksum: snapshot.checksum,
        compressedSizeBytes: snapshot.compressed_size_bytes,
        uncompressedSizeBytes: snapshot.uncompressed_size_bytes,
        recordCounts: snapshot.record_counts,
        schemaVersion: snapshot.schema_version,
        tableManifest: snapshot.table_manifest,
      })
    }

    // Download from storage
    const storage = new SnapshotStorageService(supabaseAdmin)

    try {
      const data = await storage.download(clinicId, snapshotId)

      // Return as downloadable file (convert Uint8Array to Buffer for NextResponse)
      return new NextResponse(Buffer.from(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="snapshot-${snapshotId}.json.gz"`,
          'Content-Length': data.length.toString(),
          'X-Snapshot-Checksum': snapshot.checksum,
        },
      })
    } catch (storageError) {
      console.error('Storage download error:', storageError)

      // Try to get signed URL as fallback
      try {
        const signedUrl = await storage.getSignedUrl(clinicId, snapshotId, 3600)
        return NextResponse.json({
          downloadUrl: signedUrl,
          expiresIn: 3600,
        })
      } catch {
        return NextResponse.json(
          { error: 'Snapshot file not found in storage' },
          { status: 404 }
        )
      }
    }
  } catch (error) {
    console.error('Error in GET /api/snapshots/[snapshotId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/snapshots/[snapshotId]
 * Delete a snapshot
 */
export async function DELETE(
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

    // Flag-gated Convex-only write branch. Reached only AFTER:
    //   1. resolveClinicContext (auth) succeeded,
    //   2. forbiddenIfMissingPermission(userId, clinicId, 'export_import.import') passed.
    // In convex-only write mode Supabase is unreachable, so EVERY operation below
    // would throw: the supabaseAdmin reads (clinic.workspace_id, workspace.owner_id,
    // snapshot row), the storage blob delete (SnapshotStorageService.delete ->
    // supabase.storage.remove — storage is NOT intercepted by the runtime mirror),
    // and the supabaseAdmin DB delete. This branch replicates them all against Convex
    // BEFORE the first Supabase call and keeps the Supabase path intact for the default
    // backend. The bridge has no RLS, so the same owner-only access gate is replicated
    // here before the delete.
    if (shouldUseConvexOnlyWritePath('clinic_snapshots')) {
      return deleteSnapshotInConvex(snapshotId, clinicId, userId)
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
        { error: 'Only clinic owners can delete snapshots' },
        { status: 403 }
      )
    }

    // Verify snapshot exists and belongs to this clinic
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('clinic_snapshots')
      .select('id, storage_path')
      .eq('id', snapshotId)
      .eq('clinic_id', clinicId)
      .single()

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      )
    }

    // Delete from storage
    const storage = new SnapshotStorageService(supabaseAdmin)
    try {
      await storage.delete(clinicId, snapshotId)
    } catch (storageError) {
      console.warn('Storage delete warning:', storageError)
      // Continue - file might already be deleted
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('clinic_snapshots')
      .delete()
      .eq('id', snapshotId)

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete snapshot record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedId: snapshotId,
    })
  } catch (error) {
    console.error('Error in DELETE /api/snapshots/[snapshotId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Convex-only write port of the DELETE handler. Replicates EVERY Supabase
 * operation the Supabase path performs, in the same order, against Convex:
 *
 *   1. clinic.workspace_id      -> getConvexDocumentByLegacyId('clinics')
 *      (404 'Clinic not found' if missing)
 *   2. workspace.owner_id check -> getConvexDocumentByLegacyId('workspaces')
 *      (403 'Only clinic owners can delete snapshots' if not owner)
 *   3. snapshot row + clinic    -> getConvexDocumentByLegacyId('clinic_snapshots')
 *      ownership                    (404 'Snapshot not found' if missing/mismatched)
 *   4. delete storage blob      -> deleteConvexStorageObject(bucket, path)
 *      (best-effort, mirrors SnapshotStorageService.delete swallowing not-found)
 *   5. DELETE the DB row        -> deleteConvexDocumentByLegacyId('clinic_snapshots')
 *
 * The storage bucket/path are constructed identically to
 * SnapshotStorageService.getSnapshotPath (`${clinicId}/snapshots/${snapshotId}.json.gz`
 * in bucket DEFAULT_STORAGE_CONFIG.bucketName), so the blob deleted here is the same
 * object the Supabase path removes. Matches the Supabase response shape/status exactly.
 */
async function deleteSnapshotInConvex(
  snapshotId: string,
  clinicId: string,
  userId: string
): Promise<NextResponse> {
  // 1. Resolve the clinic's workspace.
  const clinic = normalizeConvexRecord(
    await getConvexDocumentByLegacyId('clinics', clinicId) as ImportedRecord | null
  )
  if (!clinic || !clinic.workspace_id) {
    return NextResponse.json(
      { error: 'Clinic not found' },
      { status: 404 }
    )
  }

  // 2. Verify the caller owns the workspace (owner-only gate; the bridge has no RLS).
  const workspace = normalizeConvexRecord(
    await getConvexDocumentByLegacyId('workspaces', String(clinic.workspace_id)) as ImportedRecord | null
  )
  if (!workspace || String(workspace.owner_id) !== String(userId)) {
    return NextResponse.json(
      { error: 'Only clinic owners can delete snapshots' },
      { status: 403 }
    )
  }

  // 3. Verify the snapshot exists and belongs to this clinic.
  const snapshot = normalizeConvexRecord(
    await getConvexDocumentByLegacyId('clinic_snapshots', snapshotId) as ImportedRecord | null
  )
  if (!snapshot || String(snapshot.clinic_id) !== String(clinicId)) {
    return NextResponse.json(
      { error: 'Snapshot not found' },
      { status: 404 }
    )
  }

  // 4. Delete the snapshot blob from Convex Storage (best-effort, mirroring the
  //    Supabase path's swallow-on-failure behaviour — the file may already be gone).
  const bucket = DEFAULT_STORAGE_CONFIG.bucketName
  const path = `${clinicId}/snapshots/${snapshotId}.json.gz`
  try {
    await deleteConvexStorageObject(bucket, path)
  } catch (storageError) {
    console.warn('Convex storage delete warning:', storageError)
    // Continue - blob might already be deleted.
  }

  // 5. Delete the clinic_snapshots row.
  await deleteConvexDocumentByLegacyId('clinic_snapshots', snapshotId)

  return NextResponse.json({
    success: true,
    deletedId: snapshotId,
  })
}
