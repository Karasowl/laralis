/**
 * Cron endpoint for automatic clinic snapshots.
 *
 * GET - Creates scheduled snapshots for all clinics
 * POST - Manually trigger snapshot for a specific clinic
 *
 * Schedule: 0 3 * * * (daily at 3:00 AM UTC)
 * Retention: 30 days (expired snapshots are cleaned up)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSnapshotExporter, SnapshotStorageService } from '@/lib/snapshots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for all clinics

interface SnapshotResult {
  clinicId: string
  clinicName: string
  success: boolean
  snapshotId?: string
  totalRecords?: number
  error?: string
}

/**
 * GET /api/cron/snapshots
 * Creates scheduled snapshots for all active clinics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require auth
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get all active clinics
    const { data: clinics, error: clinicsError } = await supabaseAdmin
      .from('clinics')
      .select('id, name, workspace_id')
      .eq('is_active', true)

    if (clinicsError) {
      console.error('[cron/snapshots] Error fetching clinics:', clinicsError)
      return NextResponse.json(
        { error: 'Failed to fetch clinics' },
        { status: 500 }
      )
    }

    if (!clinics || clinics.length === 0) {
      console.log('[cron/snapshots] No active clinics found')
      return NextResponse.json({
        success: true,
        message: 'No active clinics to snapshot',
        results: [],
        duration: Date.now() - startTime,
      })
    }

    console.log(`[cron/snapshots] Processing ${clinics.length} clinics`)

    // Process each clinic
    const results: SnapshotResult[] = []

    for (const clinic of clinics) {
      try {
        // Get the workspace owner for the snapshot metadata
        const { data: workspace } = await supabaseAdmin
          .from('workspaces')
          .select('owner_id')
          .eq('id', clinic.workspace_id)
          .single()

        let userEmail = 'system@laralis.com'
        const ownerId = workspace?.owner_id || 'system'
        if (workspace?.owner_id) {
          const { data: user } = await supabaseAdmin.auth.admin.getUserById(
            workspace.owner_id
          )
          userEmail = user?.user?.email || userEmail
        }

        // Create the snapshot
        const exporter = createSnapshotExporter(supabaseAdmin, clinic.id, {
          userId: ownerId,
          userEmail,
          type: 'scheduled',
        })

        const result = await exporter.export()

        results.push({
          clinicId: clinic.id,
          clinicName: clinic.name,
          success: true,
          snapshotId: result.snapshotId,
          totalRecords: result.stats.totalRecords,
        })

        console.log(
          `[cron/snapshots] ✓ ${clinic.name}: ${result.stats.totalRecords} records`
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          clinicId: clinic.id,
          clinicName: clinic.name,
          success: false,
          error: errorMsg,
        })
        console.error(`[cron/snapshots] ✗ ${clinic.name}: ${errorMsg}`)
      }
    }

    // Cleanup expired snapshots
    let cleanedUp = 0
    try {
      const storage = new SnapshotStorageService(supabaseAdmin)
      for (const clinic of clinics) {
        const deleted = await storage.cleanupExpired(clinic.id)
        cleanedUp += deleted
      }
      if (cleanedUp > 0) {
        console.log(`[cron/snapshots] Cleaned up ${cleanedUp} expired snapshots`)
      }
    } catch (cleanupError) {
      console.warn('[cron/snapshots] Cleanup warning:', cleanupError)
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length
    const duration = Date.now() - startTime

    console.log(
      `[cron/snapshots] Completed: ${successCount} success, ${failureCount} failed, ${duration}ms`
    )

    return NextResponse.json({
      success: failureCount === 0,
      message: `Created ${successCount} snapshots${
        failureCount > 0 ? `, ${failureCount} failed` : ''
      }`,
      results,
      cleanedUp,
      duration,
    })
  } catch (error) {
    console.error('[cron/snapshots] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/snapshots
 * Manually trigger snapshot for a specific clinic
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security in production
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const clinicId = body.clinic_id

    if (!clinicId) {
      return NextResponse.json(
        { error: 'clinic_id is required' },
        { status: 400 }
      )
    }

    // Get clinic info
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, name, workspace_id')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // Get workspace owner
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', clinic.workspace_id)
      .single()

    let userEmail = 'system@laralis.com'
    const ownerId = workspace?.owner_id || 'system'
    if (workspace?.owner_id) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(
        workspace.owner_id
      )
      userEmail = user?.user?.email || userEmail
    }

    // Create snapshot
    const exporter = createSnapshotExporter(supabaseAdmin, clinicId, {
      userId: ownerId,
      userEmail,
      type: 'scheduled',
    })

    const result = await exporter.export()

    return NextResponse.json({
      success: true,
      clinicId,
      clinicName: clinic.name,
      snapshotId: result.snapshotId,
      stats: result.stats,
    })
  } catch (error) {
    console.error('[cron/snapshots] Error creating snapshot:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create snapshot' },
      { status: 500 }
    )
  }
}
