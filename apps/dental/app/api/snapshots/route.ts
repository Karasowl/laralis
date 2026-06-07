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
import { z } from 'zod'
import { validateSchema } from '@/lib/validation'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import {
  listConvexDocumentsByClinic,
  getConvexDocumentByLegacyId,
  decodeConvexValue,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return decodeConvexValue(rest) as ImportedRecord
}

/**
 * Convex-only replication of the three pre-export Supabase reads performed by POST
 * before it hands off to the exporter:
 *   1. clinics.workspace_id            -> getConvexDocumentByLegacyId('clinics')
 *   2. workspaces.owner_id (owner gate)-> getConvexDocumentByLegacyId('workspaces')
 *   3. auth user email                 -> mirrored supabase_auth_users row by id
 * In convex-only mode supabaseAdmin.from()/.auth.admin throw, so these gates must
 * read from Convex. Returns a NextResponse error (matching the Supabase path's
 * status/shape) when a gate fails, or the resolved { userEmail } on success.
 */
async function resolveSnapshotGatesFromConvex(
  clinicId: string,
  userId: string
): Promise<{ error: NextResponse } | { userEmail: string }> {
  const clinic = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
    | { workspace_id?: string | null }
    | null
  if (!clinic || !clinic.workspace_id) {
    return { error: NextResponse.json({ error: 'Clinic not found' }, { status: 404 }) }
  }

  const workspace = (await getConvexDocumentByLegacyId('workspaces', String(clinic.workspace_id))) as
    | { owner_id?: string | null }
    | null
  if (!workspace || workspace.owner_id !== userId) {
    return {
      error: NextResponse.json(
        { error: 'Only clinic owners can create snapshots' },
        { status: 403 }
      ),
    }
  }

  // Resolve the caller's email from the mirrored supabase_auth_users row (the
  // Supabase path uses supabaseAdmin.auth.admin.getUserById, unreachable here).
  let userEmail = ''
  const authUser = (await getConvexDocumentByLegacyId('supabase_auth_users', userId)) as
    | { email?: string | null }
    | null
  if (authUser && typeof authUser.email === 'string') {
    userEmail = authUser.email
  }

  return { userEmail }
}

const createSnapshotSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'pre-restore']).optional(),
  encrypt: z.boolean().optional(),
})

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

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'export_import.export')
    if (forbidden) return forbidden

    // Get snapshots from database (more reliable than storage manifest).
    // Flag-gated Convex branch (default Supabase). clinic_snapshots is clinic-scoped;
    // the actual snapshot FILES live in Supabase Storage (download path unaffected).
    let snapshots: ImportedRecord[] | null
    if (shouldReturnConvexData('clinic_snapshots')) {
      snapshots = (await listConvexDocumentsByClinic('clinic_snapshots', clinicId, 10000) as ImportedRecord[])
        .map(normalizeConvexRecord)
        .filter((row) => row.status === 'completed')
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    } else {
      const { data, error } = await supabaseAdmin
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
      snapshots = data
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
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'export_import.export')
    if (forbidden) return forbidden

    // Convex-only write path (DATA_WRITE_MODE_CLINIC_SNAPSHOTS=convex). Supabase is
    // unreachable, so supabaseAdmin.from()/.auth.admin throw. Replicate the owner
    // gate + email lookup from Convex, then build the snapshot via the exporter
    // (which reads clinic data Convex-aware where supported and mirrors the storage
    // blob + clinic_snapshots row to Convex).
    const convexOnly = shouldUseConvexOnlyWritePath('clinic_snapshots')

    let userEmail = ''
    if (convexOnly) {
      const gates = await resolveSnapshotGatesFromConvex(clinicId, userId)
      if ('error' in gates) return gates.error
      userEmail = gates.userEmail
    } else {
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
          { error: 'Only clinic owners can create snapshots' },
          { status: 403 }
        )
      }

      // Get user email
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId)
      userEmail = user?.user?.email || ''
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
    const parsed = validateSchema(createSnapshotSchema, bodyData)
    if ('error' in parsed) {
      return parsed.error
    }
    const body: CreateSnapshotRequest = parsed.data

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
