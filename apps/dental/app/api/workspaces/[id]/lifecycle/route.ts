import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { countWorkspaceCriticalRows, deleteWorkspaceTree } from '@/lib/workspace-lifecycle'
import { readJson, validateSchema } from '@/lib/validation'
import { forbiddenIfMissingWorkspacePermission } from '@/lib/workspace-access'
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  patchConvexDocumentByLegacyId,
  deleteConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

const lifecycleSchema = z.object({
  action: z.enum(['resume_setup', 'archive', 'delete_incomplete']),
})

function clearWorkspaceCookies(response: NextResponse) {
  response.cookies.set('workspaceId', '', { path: '/', maxAge: 0 })
  response.cookies.set('clinicId', '', { path: '/', maxAge: 0 })
}

type AnyRow = Record<string, any>

/**
 * Convex-only write path for /api/workspaces/[id]/lifecycle.
 *
 * Mirrors the Supabase handler exactly when DATA_WRITE_MODE_WORKSPACES=convex
 * (Supabase unreachable). The workspace row is read via Convex (the Supabase
 * `.from('workspaces').select()` at the top of POST would throw here), then:
 *   - resume_setup -> patch workspace { status:'draft', setup_last_seen_at,
 *     delete_after:null, updated_at } and resolve the first active clinic.
 *   - archive      -> patch workspace { status:'archived', archived_at,
 *     delete_after:null, updated_at }.
 *   - delete_incomplete -> count critical rows (patients/treatments across the
 *     workspace clinics), then cascade-delete the tree mirroring
 *     deleteWorkspaceTree/deleteClinicData order via list+delete by legacyId.
 *
 * Permission/onboarding guards already ran (and are Convex-aware) before this is
 * called, so this only reproduces the writes + reads the Supabase path performs.
 */
async function handleLifecycleInConvex(
  workspace: { id: string; name?: string | null; owner_id?: string | null; onboarding_completed?: boolean | null; status?: string | null },
  action: 'resume_setup' | 'archive' | 'delete_incomplete',
  now: string,
  cookieStore: ReturnType<typeof cookies>
): Promise<NextResponse> {
  if (action === 'resume_setup') {
    if (workspace.onboarding_completed) {
      return NextResponse.json({ error: 'Completed workspaces do not resume setup' }, { status: 400 })
    }

    const patch = {
      status: 'draft',
      setup_last_seen_at: now,
      delete_after: null,
      updated_at: now,
    }
    await patchConvexDocumentByLegacyId('workspaces', workspace.id, patch)

    const updated = { ...workspace, ...patch }

    const clinics = (await listConvexDocumentsByWorkspace('clinics', workspace.id)) as AnyRow[]
    const firstClinic = clinics
      .filter((clinic) => clinic.is_active !== false)
      .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))[0]

    const response = NextResponse.json({
      success: true,
      workspace: updated,
      clinic: firstClinic ? { id: firstClinic.id } : null,
    })
    response.cookies.set('workspaceId', workspace.id, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    if (firstClinic?.id) {
      response.cookies.set('clinicId', String(firstClinic.id), {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
    return response
  }

  if (workspace.onboarding_completed) {
    return NextResponse.json(
      { error: 'Use workspace settings to change completed workspaces' },
      { status: 400 }
    )
  }

  if (action === 'archive') {
    const patch = {
      status: 'archived',
      archived_at: now,
      delete_after: null,
      updated_at: now,
    }
    await patchConvexDocumentByLegacyId('workspaces', workspace.id, patch)

    const updated = { ...workspace, ...patch }

    const response = NextResponse.json({ success: true, workspace: updated })
    if (cookieStore.get('workspaceId')?.value === workspace.id) {
      clearWorkspaceCookies(response)
    }
    return response
  }

  // action === 'delete_incomplete'
  const counts = await countWorkspaceCriticalRowsInConvex(workspace.id)
  if (counts.hasCriticalData) {
    return NextResponse.json(
      {
        error: 'Incomplete workspace contains patient or treatment data. Archive it instead of deleting it.',
        code: 'WORKSPACE_HAS_CRITICAL_DATA',
        counts,
      },
      { status: 409 }
    )
  }

  await deleteWorkspaceTreeInConvex(workspace.id, counts.clinicIds)

  const response = NextResponse.json({ success: true, deleted: true })
  if (cookieStore.get('workspaceId')?.value === workspace.id) {
    clearWorkspaceCookies(response)
  }
  return response
}

/**
 * Convex parity for countWorkspaceCriticalRows: counts patients + treatments
 * across every clinic in the workspace. hasCriticalData blocks the destructive
 * delete exactly as the Supabase path does.
 */
async function countWorkspaceCriticalRowsInConvex(workspaceId: string) {
  const clinics = (await listConvexDocumentsByWorkspace('clinics', workspaceId)) as AnyRow[]
  const clinicIds = clinics
    .map((clinic) => clinic?.id)
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

  if (clinicIds.length === 0) {
    return { clinicIds, patients: 0, treatments: 0, hasCriticalData: false }
  }

  let patients = 0
  let treatments = 0
  for (const clinicId of clinicIds) {
    const [patientRows, treatmentRows] = await Promise.all([
      listConvexDocumentsByClinic('patients', clinicId) as Promise<AnyRow[]>,
      listConvexDocumentsByClinic('treatments', clinicId) as Promise<AnyRow[]>,
    ])
    patients += patientRows.length
    treatments += treatmentRows.length
  }

  return {
    clinicIds,
    patients,
    treatments,
    hasCriticalData: patients > 0 || treatments > 0,
  }
}

// Per-clinic table delete order mirroring CLINIC_DELETE_SEQUENCE (lib/clinic-tables.ts),
// restricted to the tables Convex actually mirrors (marketing_platforms /
// expense_categories are NOT migrated tables so the Supabase-only cleanup of those is
// skipped — patch/delete on a non-migrated table throws in Convex).
const CONVEX_CLINIC_DELETE_TABLES = [
  'treatments',
  'tariffs',
  'expenses',
  'patients',
  'services',
  'supplies',
  'assets',
  'fixed_costs',
  'settings_time',
  'marketing_campaigns',
  'categories',
  'category_types',
] as const

// Workspace-scoped tables deleted after per-clinic cleanup, mirroring
// deleteWorkspaceTree order (workspace_activity / custom_role_templates included;
// marketing_platforms/expense_categories excluded as above).
const CONVEX_WORKSPACE_DELETE_TABLES = [
  'invitations',
  'workspace_users',
  'workspace_members',
  'workspace_activity',
  'custom_role_templates',
] as const

async function deleteConvexRowsByClinic(table: string, clinicId: string) {
  const rows = (await listConvexDocumentsByClinic(table, clinicId)) as AnyRow[]
  for (const row of rows) {
    const legacyId = row?.id ?? row?.legacyId
    if (legacyId) await deleteConvexDocumentByLegacyId(table, String(legacyId))
  }
}

async function deleteConvexRowsByWorkspace(table: string, workspaceId: string) {
  const rows = (await listConvexDocumentsByWorkspace(table, workspaceId)) as AnyRow[]
  for (const row of rows) {
    const legacyId = row?.id ?? row?.legacyId
    if (legacyId) await deleteConvexDocumentByLegacyId(table, String(legacyId))
  }
}

/**
 * Convex parity for deleteWorkspaceTree + deleteClinicData. Hard-deletes the whole
 * workspace subtree in the same order Supabase does: per-clinic data first
 * (marketing_campaign_status_history -> per-table sequence) + clinic_users, then
 * workspace-scoped tables, then clinics, then the workspace row.
 */
async function deleteWorkspaceTreeInConvex(workspaceId: string, knownClinicIds: string[]) {
  const clinics = (await listConvexDocumentsByWorkspace('clinics', workspaceId)) as AnyRow[]
  const clinicIdSet = new Set<string>(knownClinicIds)
  for (const clinic of clinics) {
    if (typeof clinic?.id === 'string' && clinic.id.length > 0) clinicIdSet.add(clinic.id)
  }
  const clinicIds = Array.from(clinicIdSet)

  for (const clinicId of clinicIds) {
    // marketing_campaign_status_history is keyed by campaign_id (not clinic_id):
    // resolve this clinic's campaigns first, then delete their status history.
    const campaigns = (await listConvexDocumentsByClinic('marketing_campaigns', clinicId)) as AnyRow[]
    const campaignIds = new Set(
      campaigns
        .map((row) => row?.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    )
    if (campaignIds.size > 0) {
      const history = (await listConvexDocumentsByClinic('marketing_campaign_status_history', clinicId)) as AnyRow[]
      // Also catch history rows that only carry campaign_id (no clinic_id mirror).
      const historyByCampaign = (await listConvexDocumentsByWorkspace('marketing_campaign_status_history', workspaceId)) as AnyRow[]
      const seen = new Set<string>()
      for (const row of [...history, ...historyByCampaign]) {
        const legacyId = row?.id ?? row?.legacyId
        if (!legacyId) continue
        if (row?.campaign_id != null && !campaignIds.has(String(row.campaign_id))) continue
        const key = String(legacyId)
        if (seen.has(key)) continue
        seen.add(key)
        await deleteConvexDocumentByLegacyId('marketing_campaign_status_history', key)
      }
    }

    for (const table of CONVEX_CLINIC_DELETE_TABLES) {
      await deleteConvexRowsByClinic(table, clinicId)
    }
    await deleteConvexRowsByClinic('clinic_users', clinicId)
  }

  for (const table of CONVEX_WORKSPACE_DELETE_TABLES) {
    await deleteConvexRowsByWorkspace(table, workspaceId)
  }

  // clinics, then the workspace itself.
  for (const clinicId of clinicIds) {
    await deleteConvexDocumentByLegacyId('clinics', clinicId)
  }
  await deleteConvexDocumentByLegacyId('workspaces', workspaceId)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) return bodyResult.error

    const parsed = validateSchema(lifecycleSchema, bodyResult.data)
    if ('error' in parsed) return parsed.error

    const convexOnly = shouldUseConvexOnlyWritePath('workspaces')

    let workspace: {
      id: string
      name?: string | null
      owner_id?: string | null
      onboarding_completed?: boolean | null
      status?: string | null
    } | null = null

    if (convexOnly) {
      // Supabase is unreachable in convex-only mode: read the workspace from Convex
      // (the Supabase `.from('workspaces').select()` would throw here).
      const convexWorkspace = (await getConvexDocumentByLegacyId('workspaces', params.id)) as
        | Record<string, any>
        | null
      if (convexWorkspace) {
        workspace = {
          id: String(convexWorkspace.id ?? convexWorkspace.legacyId ?? params.id),
          name: convexWorkspace.name ?? null,
          owner_id: convexWorkspace.owner_id ?? null,
          onboarding_completed: convexWorkspace.onboarding_completed ?? null,
          status: convexWorkspace.status ?? null,
        }
      }
    } else {
      const { data, error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .select('id, name, owner_id, onboarding_completed, status')
        .eq('id', params.id)
        .single()
      if (!workspaceError && data) workspace = data
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 })
    }

    const forbidden = await forbiddenIfMissingWorkspacePermission(user.id, params.id, 'settings.edit')
    if (forbidden) return forbidden

    const now = new Date().toISOString()

    if (convexOnly) {
      return handleLifecycleInConvex(workspace, parsed.data.action, now, cookieStore)
    }

    if (parsed.data.action === 'resume_setup') {
      if (workspace.onboarding_completed) {
        return NextResponse.json({ error: 'Completed workspaces do not resume setup' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('workspaces')
        .update({
          status: 'draft',
          setup_last_seen_at: now,
          delete_after: null,
          updated_at: now,
        })
        .eq('id', workspace.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to resume setup', details: updateError.message }, { status: 500 })
      }

      const { data: firstClinic } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const response = NextResponse.json({ success: true, workspace: updated, clinic: firstClinic ?? null })
      response.cookies.set('workspaceId', workspace.id, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
      if (firstClinic?.id) {
        response.cookies.set('clinicId', firstClinic.id, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        })
      }
      return response
    }

    if (workspace.onboarding_completed) {
      return NextResponse.json(
        { error: 'Use workspace settings to change completed workspaces' },
        { status: 400 }
      )
    }

    if (parsed.data.action === 'archive') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('workspaces')
        .update({
          status: 'archived',
          archived_at: now,
          delete_after: null,
          updated_at: now,
        })
        .eq('id', workspace.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to archive workspace', details: updateError.message }, { status: 500 })
      }

      const response = NextResponse.json({ success: true, workspace: updated })
      if (cookieStore.get('workspaceId')?.value === workspace.id) {
        clearWorkspaceCookies(response)
      }
      return response
    }

    const counts = await countWorkspaceCriticalRows(workspace.id)
    if (counts.hasCriticalData) {
      return NextResponse.json(
        {
          error: 'Incomplete workspace contains patient or treatment data. Archive it instead of deleting it.',
          code: 'WORKSPACE_HAS_CRITICAL_DATA',
          counts,
        },
        { status: 409 }
      )
    }

    await deleteWorkspaceTree(workspace.id)

    const response = NextResponse.json({ success: true, deleted: true })
    if (cookieStore.get('workspaceId')?.value === workspace.id) {
      clearWorkspaceCookies(response)
    }
    return response
  } catch (error) {
    console.error('[workspace-lifecycle] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
