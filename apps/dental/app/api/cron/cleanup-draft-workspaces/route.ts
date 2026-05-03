import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireCronAuth } from '@/lib/cron-auth'
import {
  WORKSPACE_DRAFT_EXPIRY_DAYS,
  WORKSPACE_EXPIRED_PURGE_DAYS,
  addDays,
  countWorkspaceCriticalRows,
  daysAgo,
  deleteWorkspaceTree,
} from '@/lib/workspace-lifecycle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type CleanupResult = {
  expired: Array<{ id: string; name: string | null; delete_after: string }>
  archived: Array<{ id: string; name: string | null; patients: number; treatments: number }>
  deleted: Array<{ id: string; name: string | null }>
  skipped: Array<{ id: string; name: string | null; reason: string }>
}

function getTimestamp(row: any) {
  const raw = row?.setup_last_seen_at || row?.updated_at || row?.created_at
  const date = raw ? new Date(raw) : new Date(0)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
  const now = new Date()
  const draftCutoff = daysAgo(WORKSPACE_DRAFT_EXPIRY_DAYS)

  const results: CleanupResult = {
    expired: [],
    archived: [],
    deleted: [],
    skipped: [],
  }

  try {
    const { data: drafts, error: draftError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, status, onboarding_completed, setup_last_seen_at, updated_at, created_at')
      .eq('status', 'draft')
      .eq('onboarding_completed', false)

    if (draftError) throw draftError

    for (const workspace of drafts ?? []) {
      if (getTimestamp(workspace) >= draftCutoff) continue

      const deleteAfter = addDays(now, WORKSPACE_EXPIRED_PURGE_DAYS).toISOString()
      results.expired.push({
        id: workspace.id,
        name: workspace.name ?? null,
        delete_after: deleteAfter,
      })

      if (!dryRun) {
        const { error: updateError } = await supabaseAdmin
          .from('workspaces')
          .update({
            status: 'expired',
            delete_after: deleteAfter,
            updated_at: now.toISOString(),
          })
          .eq('id', workspace.id)
          .eq('status', 'draft')
          .eq('onboarding_completed', false)

        if (updateError) throw updateError
      }
    }

    const { data: expiredWorkspaces, error: expiredError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, delete_after')
      .eq('status', 'expired')
      .eq('onboarding_completed', false)
      .not('delete_after', 'is', null)
      .lte('delete_after', now.toISOString())

    if (expiredError) throw expiredError

    for (const workspace of expiredWorkspaces ?? []) {
      const counts = await countWorkspaceCriticalRows(workspace.id)

      if (counts.hasCriticalData) {
        results.archived.push({
          id: workspace.id,
          name: workspace.name ?? null,
          patients: counts.patients,
          treatments: counts.treatments,
        })

        if (!dryRun) {
          const { error: archiveError } = await supabaseAdmin
            .from('workspaces')
            .update({
              status: 'archived',
              archived_at: now.toISOString(),
              delete_after: null,
              updated_at: now.toISOString(),
            })
            .eq('id', workspace.id)
            .eq('status', 'expired')

          if (archiveError) throw archiveError
        }

        continue
      }

      results.deleted.push({
        id: workspace.id,
        name: workspace.name ?? null,
      })

      if (!dryRun) {
        await deleteWorkspaceTree(workspace.id)
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      policy: {
        draftExpiresAfterDays: WORKSPACE_DRAFT_EXPIRY_DAYS,
        expiredPurgesAfterDays: WORKSPACE_EXPIRED_PURGE_DAYS,
      },
      results,
    })
  } catch (error) {
    console.error('[cron/cleanup-draft-workspaces] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error', results },
      { status: 500 }
    )
  }
}
