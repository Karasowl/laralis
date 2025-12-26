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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const { clinicId } = clinicContext

    // Verify snapshot exists and belongs to this clinic
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('clinic_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .eq('clinic_id', clinicId)
      .single()

    if (snapshotError || !snapshot) {
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

    // Verify user is owner
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('clinic_users')
      .select('role')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership || membership.role !== 'owner') {
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
