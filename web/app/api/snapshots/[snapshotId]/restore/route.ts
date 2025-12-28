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
  RestoreSnapshotRequest,
  RestoreSnapshotResponse,
} from '@/lib/snapshots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    // Parse request body
    let body: RestoreSnapshotRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine, use defaults
    }

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
