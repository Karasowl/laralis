import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByWorkspace,
  listConvexDocumentsByClinic,
  patchConvexDocumentByLegacyId,
  decodeConvexValue,
  userHasActiveWorkspaceMembershipFromConvex,
} from '@/lib/convex/server';
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend';

const ROLE_PERMISSIONS_DOMAIN = 'role_permissions';

type ConvexRow = Record<string, any>;

// Schema for updating a workspace member
const updateMemberSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  allowed_clinics: z.array(z.string().uuid()).optional(),
  custom_permissions: z.record(z.boolean()).nullable().optional(),
  custom_role_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * PUT /api/team/workspace-members/[id]
 *
 * Update a workspace member's role, permissions, or clinic access.
 * Requires: team.edit_roles permission
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  const cookieStore = cookies();
  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;

  try {
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.edit_roles');
    if (forbidden) return forbidden;

    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data as Record<string, unknown>;

    // Flag-gated Convex-only write branch. Reached only AFTER:
    //   1. resolveClinicContext (auth) succeeded,
    //   2. forbiddenIfMissingPermission(userId, clinicId, 'team.edit_roles') passed.
    // It MUST run BEFORE any supabaseAdmin call: in convex-only mode Supabase is
    // unreachable, so every read/write below would throw. It mirrors the EXACT
    // Supabase flow (clinic.workspace_id resolution, current-membership +
    // target-member checks, all permission gates) and then the single write:
    //   supabaseAdmin.from('workspace_users').update(updateData).eq('id', memberId)
    // The Convex bridge has NO RLS, so the access check is replicated here.
    if (shouldUseConvexOnlyWritePath(ROLE_PERMISSIONS_DOMAIN)) {
      return updateWorkspaceMemberInConvex(memberId, userId, clinicId, body);
    }

    // Get workspace ID from clinic
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    const workspaceId = clinic.workspace_id;

    // Get current user's membership
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!currentMembership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id, user_id, role, workspace_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify target member belongs to same workspace
    if (targetMember.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: 'Member not in this workspace' },
        { status: 403 }
      );
    }

    // Permission checks
    const currentRole = currentMembership.role;
    const targetRole = targetMember.role;

    // Cannot modify owner
    if (targetRole === 'owner') {
      return NextResponse.json(
        { error: 'Cannot modify owner' },
        { status: 403 }
      );
    }

    // Cannot modify yourself (except allowed_clinics)
    if (targetMember.user_id === userId) {
      if (body.role || body.is_active === false) {
        return NextResponse.json(
          { error: 'Cannot modify your own role or deactivate yourself' },
          { status: 403 }
        );
      }
    }

    // Only owner/super_admin can edit roles
    if (!['owner', 'super_admin'].includes(currentRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit roles' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const validatedData = updateMemberSchema.parse(body);

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role;
    }

    if (validatedData.allowed_clinics !== undefined) {
      updateData.allowed_clinics = validatedData.allowed_clinics;
    }

    if (validatedData.custom_permissions !== undefined) {
      updateData.custom_permissions = validatedData.custom_permissions;
    }

    if (validatedData.custom_role_id !== undefined) {
      updateData.custom_role_id = validatedData.custom_role_id;
    }

    if (validatedData.is_active !== undefined) {
      updateData.is_active = validatedData.is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update member
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('workspace_users')
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) {
      console.error('[workspace-members] Error updating member:', updateError);
      return NextResponse.json(
        { error: 'Failed to update member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[workspace-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/workspace-members/[id]
 *
 * Remove a workspace member (deactivate, not delete).
 * Requires: team.remove permission
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  const cookieStore = cookies();
  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;

  try {
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.remove');
    if (forbidden) return forbidden;

    // Flag-gated Convex-only write branch (see PUT for rationale). Mirrors the
    // EXACT Supabase flow (clinic.workspace_id resolution, owner/super_admin
    // gate, target-member checks) and then the TWO writes the Supabase path does:
    //   1. workspace_users.update({ is_active: false }).eq('id', memberId)
    //   2. clinic_users.update({ is_active: false }) for that user across every
    //      clinic in the workspace.
    if (shouldUseConvexOnlyWritePath(ROLE_PERMISSIONS_DOMAIN)) {
      return removeWorkspaceMemberInConvex(memberId, userId, clinicId);
    }

    // Get workspace ID from clinic
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    const workspaceId = clinic.workspace_id;

    // Get current user's membership
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!currentMembership || !['owner', 'super_admin'].includes(currentMembership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove members' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id, user_id, role, workspace_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify target member belongs to same workspace
    if (targetMember.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: 'Member not in this workspace' },
        { status: 403 }
      );
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove workspace owner' },
        { status: 403 }
      );
    }

    // Cannot remove yourself
    if (targetMember.user_id === userId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from workspace' },
        { status: 403 }
      );
    }

    // Deactivate member instead of deleting
    const { error: updateError } = await supabaseAdmin
      .from('workspace_users')
      .update({ is_active: false })
      .eq('id', memberId);

    if (updateError) {
      console.error('[workspace-members] Error removing member:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    // Also deactivate from all clinic_users
    await supabaseAdmin
      .from('clinic_users')
      .update({ is_active: false })
      .eq('user_id', targetMember.user_id)
      .in('clinic_id', (
        await supabaseAdmin
          .from('clinics')
          .select('id')
          .eq('workspace_id', workspaceId)
      ).data?.map(c => c.id) || []);

    return NextResponse.json({
      success: true,
      message: 'Member removed from workspace',
    });
  } catch (error) {
    console.error('[workspace-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Convex-only equivalent of the PUT Supabase write path.
 *
 * Mirrors EXACTLY (same order, same statuses, same error strings):
 *   1. clinics.select(workspace_id).eq(id, clinicId)           -> 404 if missing
 *   2. workspace_users active membership for (workspace, user) -> 403 Access denied
 *   3. workspace_users.eq(id, memberId)                        -> 404 Member not found
 *   4. targetMember.workspace_id !== workspaceId               -> 403
 *   5. owner / self / role gates                               -> 403
 *   6. updateMemberSchema.parse + build updateData             -> 400 if empty
 *   7. workspace_users.update(updateData).eq(id, memberId)     -> single write
 *
 * custom_permissions is a JSONB permission map; patchConvexDocumentByLegacyId
 * encodes the whole patch (encodeConvexValue) before writing, so the stored keys
 * match the encoded form the read branch decodes. The returned `member` is the
 * stored row merged with the patch (decoded), matching the post-update row the
 * Supabase `.update().select().single()` returns.
 */
async function updateWorkspaceMemberInConvex(
  memberId: string,
  userId: string,
  clinicId: string,
  body: Record<string, unknown>
) {
  // 1. Resolve workspace from clinic.
  const clinic = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
    | { workspace_id?: string | null }
    | null;
  if (!clinic) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
  }
  const workspaceId = clinic.workspace_id ?? null;
  if (!workspaceId) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
  }

  // 2. Current user's active membership (replicates the RLS access gate).
  const hasActiveMembership = await userHasActiveWorkspaceMembershipFromConvex(
    workspaceId,
    userId
  );
  if (!hasActiveMembership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const currentRole = await currentWorkspaceRoleFromConvex(workspaceId, userId);

  // 3. Target member (lookup by id, NO workspace filter — matches Supabase).
  const targetMember = (await getConvexDocumentByLegacyId(
    'workspace_users',
    memberId
  )) as ConvexRow | null;
  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // 4. Same-workspace check.
  if (String(targetMember.workspace_id) !== String(workspaceId)) {
    return NextResponse.json(
      { error: 'Member not in this workspace' },
      { status: 403 }
    );
  }

  // 5. Permission gates (identical to the Supabase branch).
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot modify owner' }, { status: 403 });
  }
  if (String(targetMember.user_id) === String(userId)) {
    if (body.role || body.is_active === false) {
      return NextResponse.json(
        { error: 'Cannot modify your own role or deactivate yourself' },
        { status: 403 }
      );
    }
  }
  if (!currentRole || !['owner', 'super_admin'].includes(currentRole)) {
    return NextResponse.json(
      { error: 'Insufficient permissions to edit roles' },
      { status: 403 }
    );
  }

  // 6. Validate + build update object.
  const validatedData = updateMemberSchema.parse(body);
  const updateData: Record<string, unknown> = {};
  if (validatedData.role !== undefined) updateData.role = validatedData.role;
  if (validatedData.allowed_clinics !== undefined)
    updateData.allowed_clinics = validatedData.allowed_clinics;
  if (validatedData.custom_permissions !== undefined)
    updateData.custom_permissions = validatedData.custom_permissions;
  if (validatedData.custom_role_id !== undefined)
    updateData.custom_role_id = validatedData.custom_role_id;
  if (validatedData.is_active !== undefined)
    updateData.is_active = validatedData.is_active;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // 7. Single write. patchConvexDocumentByLegacyId encodes the patch (including
  // the custom_permissions JSONB keys) before storing.
  await patchConvexDocumentByLegacyId('workspace_users', memberId, updateData);

  // Build the post-update row to return, mirroring .update().select().single().
  // The stored row keys are encoded; decode before merging with the (canonical)
  // updateData so the response carries canonical custom_permissions keys.
  const decodedExisting = decodeConvexValue(targetMember) as ConvexRow;
  const updatedMember = { ...decodedExisting, ...updateData };

  return NextResponse.json({
    success: true,
    member: updatedMember,
  });
}

/**
 * Resolve the active workspace_users role for (workspace, user) from Convex.
 * Mirrors supabaseAdmin.from('workspace_users').select('role')
 *   .eq('workspace_id').eq('user_id').eq('is_active', true).single()
 * Returns null when there is no active membership.
 */
async function currentWorkspaceRoleFromConvex(
  workspaceId: string,
  userId: string
): Promise<string | null> {
  const rows = (await listConvexDocumentsByWorkspace(
    'workspace_users',
    workspaceId
  )) as ConvexRow[];
  const row = rows.find(
    (r) =>
      String(r.workspace_id) === String(workspaceId) &&
      String(r.user_id) === String(userId) &&
      r.is_active === true
  );
  return row ? (row.role as string) : null;
}

/**
 * Convex-only equivalent of the DELETE Supabase write path.
 *
 * Mirrors EXACTLY (same order, same statuses, same error strings):
 *   1. clinics.select(workspace_id).eq(id, clinicId)             -> 404 if missing
 *   2. workspace_users active membership owner/super_admin gate  -> 403
 *   3. workspace_users.eq(id, memberId)                          -> 404 Member not found
 *   4. targetMember.workspace_id !== workspaceId                 -> 403
 *   5. owner / self gates                                        -> 403
 *   6. workspace_users.update({ is_active: false }).eq(id)       -> soft delete
 *   7. clinic_users.update({ is_active: false }) for that user
 *      across every clinic in the workspace                      -> cascade
 */
async function removeWorkspaceMemberInConvex(
  memberId: string,
  userId: string,
  clinicId: string
) {
  // 1. Resolve workspace from clinic.
  const clinic = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
    | { workspace_id?: string | null }
    | null;
  if (!clinic) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
  }
  const workspaceId = clinic.workspace_id ?? null;
  if (!workspaceId) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
  }

  // 2. Current user must hold an active owner/super_admin membership.
  const currentRole = await currentWorkspaceRoleFromConvex(workspaceId, userId);
  if (!currentRole || !['owner', 'super_admin'].includes(currentRole)) {
    return NextResponse.json(
      { error: 'Insufficient permissions to remove members' },
      { status: 403 }
    );
  }

  // 3. Target member (lookup by id, NO workspace filter — matches Supabase).
  const targetMember = (await getConvexDocumentByLegacyId(
    'workspace_users',
    memberId
  )) as ConvexRow | null;
  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // 4. Same-workspace check.
  if (String(targetMember.workspace_id) !== String(workspaceId)) {
    return NextResponse.json(
      { error: 'Member not in this workspace' },
      { status: 403 }
    );
  }

  // 5. Owner / self gates.
  if (targetMember.role === 'owner') {
    return NextResponse.json(
      { error: 'Cannot remove workspace owner' },
      { status: 403 }
    );
  }
  if (String(targetMember.user_id) === String(userId)) {
    return NextResponse.json(
      { error: 'Cannot remove yourself from workspace' },
      { status: 403 }
    );
  }

  // 6. Soft-delete the workspace_users membership.
  await patchConvexDocumentByLegacyId('workspace_users', memberId, {
    is_active: false,
  });

  // 7. Soft-delete the user's clinic_users rows across every clinic in the
  // workspace (replicates the Supabase clinic_users update with the
  // clinic_id IN (clinics of workspace) filter).
  const targetUserId = String(targetMember.user_id);
  const workspaceClinics = (await listConvexDocumentsByWorkspace(
    'clinics',
    workspaceId
  )) as ConvexRow[];
  for (const clinicRow of workspaceClinics) {
    const childClinicId = String(clinicRow.id ?? clinicRow.legacyId ?? '');
    if (!childClinicId) continue;
    const clinicMembers = (await listConvexDocumentsByClinic(
      'clinic_users',
      childClinicId
    )) as ConvexRow[];
    for (const member of clinicMembers) {
      if (String(member.user_id) !== targetUserId) continue;
      const memberLegacyId = String(member.id ?? member.legacyId ?? '');
      if (!memberLegacyId) continue;
      await patchConvexDocumentByLegacyId('clinic_users', memberLegacyId, {
        is_active: false,
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Member removed from workspace',
  });
}
