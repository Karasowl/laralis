/**
 * Snapshots API
 *
 * GET /api/snapshots - List all snapshots for the current clinic
 * POST /api/snapshots - Create a new snapshot
 *
 * Only clinic owners can create snapshots (enforced by RLS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  createSnapshotExporter,
  SnapshotStorageService,
  SnapshotType,
  CreateSnapshotRequest,
  ListSnapshotsResponse,
  CreateSnapshotResponse,
} from '@/lib/snapshots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/snapshots
 * List all snapshots for the current clinic
 */
export async function GET(request: NextRequest) {
  try {
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

    const { clinicId } = clinicContext

    // Get snapshots from database (more reliable than storage manifest)
    const { data: snapshots, error } = await supabaseAdmin
      .from('clinic_snapshots')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to list snapshots:', error)
      return NextResponse.json(
        { error: 'Failed to list snapshots' },
        { status: 500 }
      )
    }

    // Transform to response format
    const response: ListSnapshotsResponse = {
      snapshots: (snapshots || []).map((s) => ({
        id: s.id,
        clinicId: s.clinic_id,
        clinicName: s.metadata?.clinicName || '',
        workspaceId: s.metadata?.workspaceId || '',
        createdAt: s.created_at,
        createdBy: {
          userId: s.created_by || '',
          email: '', // Not stored in DB for privacy
        },
        type: s.type as SnapshotType,
        schemaVersion: s.schema_version,
        appVersion: s.app_version || '1.0.0',
        checksums: {
          bundle: s.checksum,
          perTable: {},
        },
        stats: {
          totalRecords: Object.values(s.record_counts || {}).reduce(
            (a: number, b) => a + (b as number),
            0
          ),
          recordsByTable: s.record_counts || {},
          compressedSizeBytes: s.compressed_size_bytes || 0,
          uncompressedSizeBytes: s.uncompressed_size_bytes || 0,
          exportDurationMs: 0,
        },
      })),
      totalCount: snapshots?.length || 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in GET /api/snapshots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/snapshots
 * Create a new snapshot for the current clinic
 */
export async function POST(request: NextRequest) {
  try {
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

    // Verify user is owner
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('clinic_users')
      .select('role')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only clinic owners can create snapshots' },
        { status: 403 }
      )
    }

    // Get user email
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId)
    const userEmail = user?.user?.email || ''

    // Parse request body
    let body: CreateSnapshotRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine, use defaults
    }

    // Create exporter and export
    const exporter = createSnapshotExporter(supabaseAdmin, clinicId, {
      userId,
      userEmail,
      type: body.type || 'manual',
    })

    const result = await exporter.export()

    const response: CreateSnapshotResponse = {
      success: true,
      snapshotId: result.snapshotId,
      stats: result.stats,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/snapshots:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create snapshot',
      },
      { status: 500 }
    )
  }
}
