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
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSnapshotExporter, SnapshotStorageService } from '@/lib/snapshots'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { requireCronAuth } from '@/lib/cron-auth'
import { resolveClinicContext } from '@/lib/clinic'
import { getConvexDocumentByLegacyId, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for all clinics

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

const DEFAULT_SNAPSHOT_EMAIL = 'system@laralis.com'

/**
 * Resolve the workspace owner id + email used as snapshot metadata.
 *
 * Convex-only (DATA_READ_BACKEND=convex): Supabase is unreachable so
 * supabaseAdmin.from()/auth.admin.* throw. Read the workspace owner from the
 * Convex `workspaces` mirror (keyed by id) and the owner email from the
 * `supabase_auth_users` mirror (which stores the JSON-serialized auth user).
 * Email is best-effort metadata; fall back to the system address when missing.
 *
 * Default Supabase path keeps the original behaviour intact.
 */
async function resolveSnapshotActor(
  workspaceId: string
): Promise<{ ownerId: string; userEmail: string }> {
  if (shouldReturnConvexData('clinic_snapshots')) {
    const workspace = (await getConvexDocumentByLegacyId('workspaces', workspaceId)) as
      | { owner_id?: string }
      | null
    const ownerId = workspace?.owner_id || 'system'

    let userEmail = DEFAULT_SNAPSHOT_EMAIL
    if (workspace?.owner_id) {
      const authUser = (await getConvexDocumentByLegacyId(
        'supabase_auth_users',
        workspace.owner_id
      )) as { email?: string } | null
      userEmail = authUser?.email || userEmail
    }

    return { ownerId, userEmail }
  }

  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single()

  const ownerId = workspace?.owner_id || 'system'
  let userEmail = DEFAULT_SNAPSHOT_EMAIL
  if (workspace?.owner_id) {
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(workspace.owner_id)
    userEmail = user?.user?.email || userEmail
  }

  return { ownerId, userEmail }
}

const snapshotRequestSchema = z.object({
  clinic_id: z.string().uuid(),
})

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
    const denied = requireCronAuth(request)
    if (denied) return denied

    // Get all active clinics. clinics is keyed by id (no clinic_id column) and
    // this read spans all workspaces, so the Convex branch reads the whole table
    // and filters in JS. Flag-gated, default Supabase. The per-clinic snapshot
    // exporter below stays on Supabase (it dumps the Supabase database).
    let clinics: Array<{ id: any; name: any; workspace_id: any }> | null
    if (shouldReturnConvexData('clinics')) {
      clinics = (await listConvexTable('clinics', 10000) as ImportedRecord[])
        .map(normalizeConvexRecord)
        .filter((row) => row.is_active === true)
        .map((row) => ({ id: row.id, name: row.name, workspace_id: row.workspace_id }))
    } else {
      const { data, error: clinicsError } = await supabaseAdmin
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
      clinics = data
    }

    if (!clinics || clinics.length === 0) {
      console.info('[cron/snapshots] No active clinics found')
      return NextResponse.json({
        success: true,
        message: 'No active clinics to snapshot',
        results: [],
        duration: Date.now() - startTime,
      })
    }

    console.info(`[cron/snapshots] Processing ${clinics.length} clinics`)

    // Process each clinic
    const results: SnapshotResult[] = []

    for (const clinic of clinics) {
      try {
        // Get the workspace owner for the snapshot metadata (convex-aware).
        const { ownerId, userEmail } = await resolveSnapshotActor(clinic.workspace_id)

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

        console.info(
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
        console.info(`[cron/snapshots] Cleaned up ${cleanedUp} expired snapshots`)
      }
    } catch (cleanupError) {
      console.warn('[cron/snapshots] Cleanup warning:', cleanupError)
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length
    const duration = Date.now() - startTime

    console.info(
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
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(snapshotRequestSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }

    // Auth: either a valid Vercel cron bearer token, OR an authenticated
    // user that owns the requested clinic. Don't require both — manual
    // snapshot from the dashboard should work without the cron secret.
    const denied = requireCronAuth(request)
    if (denied) {
      const cookieStore = cookies()
      const ctx = await resolveClinicContext({
        requestedClinicId: parsed.data.clinic_id,
        cookieStore,
      })
      if ('error' in ctx) {
        return NextResponse.json(
          { error: ctx.error.message },
          { status: ctx.error.status }
        )
      }
      // proceed using the verified clinicId from the user's context
      parsed.data.clinic_id = ctx.clinicId
    }
    const clinicId = parsed.data.clinic_id

    // Get clinic info. clinics is keyed by id; the Convex branch reads the doc
    // by legacy id. Flag-gated, default Supabase. Convex-only mode (Supabase
    // unreachable) would otherwise throw on supabaseAdmin.from().
    let clinic: { id: any; name: any; workspace_id: any } | null
    if (shouldReturnConvexData('clinics')) {
      const doc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as ImportedRecord | null
      clinic = doc ? { id: doc.id, name: doc.name, workspace_id: doc.workspace_id } : null
    } else {
      const { data, error: clinicError } = await supabaseAdmin
        .from('clinics')
        .select('id, name, workspace_id')
        .eq('id', clinicId)
        .single()
      clinic = clinicError ? null : data
    }

    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    // Get workspace owner + email for snapshot metadata (convex-aware).
    const { ownerId, userEmail } = await resolveSnapshotActor(clinic.workspace_id)

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
