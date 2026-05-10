import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { userHasPermission, type Permission } from '@/lib/permissions'

export async function getWorkspaceMembershipIds(userId: string): Promise<string[]> {
  const ids = new Set<string>()

  for (const table of ['workspace_users', 'workspace_members']) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('workspace_id')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        console.warn(`[workspace-access] Unable to fetch ${table} memberships:`, error.message)
        continue
      }

      for (const row of data || []) {
        if (row.workspace_id) ids.add(row.workspace_id)
      }
    } catch (error) {
      console.warn(`[workspace-access] Unexpected ${table} membership lookup error:`, error)
    }
  }

  return Array.from(ids)
}

export async function getAccessibleWorkspaceIds(userId: string): Promise<string[]> {
  const ids = new Set<string>()

  const { data: ownedWorkspaces, error } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)

  if (error) {
    console.error('[workspace-access] Error fetching owned workspaces:', error)
  }

  for (const workspace of ownedWorkspaces || []) {
    if (workspace.id) ids.add(workspace.id)
  }

  for (const workspaceId of await getWorkspaceMembershipIds(userId)) {
    ids.add(workspaceId)
  }

  return Array.from(ids)
}

export async function userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  const { data: ownedWorkspace } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownedWorkspace) return true

  const membershipIds = await getWorkspaceMembershipIds(userId)
  return membershipIds.includes(workspaceId)
}

export async function forbiddenIfMissingWorkspacePermission(
  userId: string,
  workspaceId: string,
  permission: Permission
): Promise<NextResponse<any> | null> {
  const { data: workspace, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, owner_id')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error || !workspace) {
    return NextResponse.json(
      { error: 'Workspace not found or unauthorized' },
      { status: 404 }
    )
  }

  if (workspace.owner_id === userId) return null

  const membershipIds = await getWorkspaceMembershipIds(userId)
  if (!membershipIds.includes(workspaceId)) {
    return NextResponse.json(
      { error: 'Workspace not found or unauthorized' },
      { status: 404 }
    )
  }

  const { data: clinics, error: clinicsError } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  if (clinicsError) {
    console.error('[workspace-access] Error fetching workspace clinics:', clinicsError)
    return NextResponse.json(
      { error: 'Failed to validate workspace permission' },
      { status: 500 }
    )
  }

  for (const clinic of clinics || []) {
    if (await userHasPermission(userId, clinic.id, permission)) {
      return null
    }
  }

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: `You do not have permission: ${permission}`,
    },
    { status: 403 }
  )
}
