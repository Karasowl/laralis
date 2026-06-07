import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  patchConvexDocumentByLegacyId,
  decodeConvexValue,
} from '@/lib/convex/server';

type ConvexRow = Record<string, any>;

/**
 * Convex parity for the Supabase access lookups this route performs interleaved with
 * its write. In convex-only write mode Supabase is unreachable (supabaseAdmin.from()
 * throws), so the clinic/workspace/clinic-membership reads that gate the PUT/DELETE
 * must be served from the mirrored Convex tables instead. These helpers mirror the
 * exact `.eq(...).single()` predicates of the Supabase path (strict is_active === true
 * for membership lookups, so the convex branch never grants access the Supabase path
 * would deny).
 */
async function getClinicWorkspaceIdFromConvex(clinicId: string): Promise<string | null> {
  const clinicDoc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as ConvexRow | null;
  if (!clinicDoc) return null;
  return clinicDoc.workspace_id ? String(clinicDoc.workspace_id) : null;
}

async function getActiveWorkspaceRoleFromConvex(
  workspaceId: string,
  userId: string
): Promise<string | null> {
  const rows = (await listConvexDocumentsByWorkspace('workspace_users', workspaceId)) as ConvexRow[];
  const match = (rows || []).find(
    (row) =>
      String(row.workspace_id) === String(workspaceId) &&
      String(row.user_id) === String(userId) &&
      row.is_active === true
  );
  return match ? String(match.role) : null;
}

async function getActiveClinicRoleFromConvex(
  clinicId: string,
  userId: string
): Promise<string | null> {
  const rows = (await listConvexDocumentsByClinic('clinic_users', clinicId)) as ConvexRow[];
  const match = (rows || []).find(
    (row) =>
      String(row.clinic_id) === String(clinicId) &&
      String(row.user_id) === String(userId) &&
      row.is_active === true
  );
  return match ? String(match.role) : null;
}

// Mirror of `supabaseAdmin.from('clinic_users').select(...).eq('id', memberId).single()`:
// look the target member up by its own id (NOT scoped to clinic) so the downstream
// `clinic_id !== clinicId` check can distinguish "not found" (404) from
// "found but in a different clinic" (403), exactly as the Supabase path does.
async function getClinicMemberByIdFromConvex(memberId: string): Promise<ConvexRow | null> {
  return (await getConvexDocumentByLegacyId('clinic_users', memberId)) as ConvexRow | null;
}

// Schema for updating a clinic member
const updateMemberSchema = z.object({
  role: z.enum(['admin', 'doctor', 'assistant', 'receptionist', 'viewer']).optional(),
  custom_permissions: z.record(z.boolean()).nullable().optional(),
  custom_role_id: z.string().uuid().nullable().optional(),
  can_access_all_patients: z.boolean().optional(),
  assigned_chair: z.string().nullable().optional(),
  schedule: z.record(z.unknown()).nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * PUT /api/team/clinic-members/[id]
 *
 * Update a clinic member's role, permissions, or other settings.
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

    // Flag-gated Convex-only write branch. Runs ONLY after auth (resolveClinicContext)
    // and the team.edit_roles permission guard. In convex-only write mode Supabase is
    // unreachable, so every access read + the clinic_users update must go through Convex.
    // This replicates the full Supabase flow (clinic lookup -> caller authorization ->
    // target member lookup -> self/owner guards -> validate -> patch) BEFORE the
    // supabaseAdmin path below, and returns the SAME { success, member } shape.
    if (shouldUseConvexOnlyWritePath('role_permissions')) {
      const workspaceId = await getClinicWorkspaceIdFromConvex(clinicId);
      if (!workspaceId) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }

      const currentWorkspaceRole = await getActiveWorkspaceRoleFromConvex(workspaceId, userId);
      const currentClinicRole = await getActiveClinicRoleFromConvex(clinicId, userId);

      const canEdit =
        (currentWorkspaceRole && ['owner', 'super_admin', 'admin'].includes(currentWorkspaceRole)) ||
        currentClinicRole === 'admin';

      if (!canEdit) {
        return NextResponse.json(
          { error: 'Insufficient permissions to edit clinic members' },
          { status: 403 }
        );
      }

      const targetMember = await getClinicMemberByIdFromConvex(memberId);

      if (!targetMember) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      if (String(targetMember.clinic_id) !== String(clinicId)) {
        return NextResponse.json({ error: 'Member not in this clinic' }, { status: 403 });
      }

      if (String(targetMember.user_id) === String(userId)) {
        if (body.role || body.is_active === false) {
          return NextResponse.json(
            { error: 'Cannot modify your own role or deactivate yourself' },
            { status: 403 }
          );
        }
      }

      const targetWorkspaceRole = await getActiveWorkspaceRoleFromConvex(
        workspaceId,
        String(targetMember.user_id)
      );

      if (targetWorkspaceRole === 'owner') {
        const blockedFields = [
          'role',
          'custom_permissions',
          'custom_role_id',
          'is_active',
          'can_access_all_patients',
        ];
        const hasBlockedChange = blockedFields.some((field) => field in body);

        if (hasBlockedChange) {
          return NextResponse.json(
            { error: 'Cannot modify access for workspace owner' },
            { status: 403 }
          );
        }
      }

      const validatedData = updateMemberSchema.parse(body);

      const updateData: Record<string, unknown> = {};

      if (validatedData.role !== undefined) {
        updateData.role = validatedData.role;
      }
      if (validatedData.custom_permissions !== undefined) {
        updateData.custom_permissions = validatedData.custom_permissions;
      }
      if (validatedData.custom_role_id !== undefined) {
        updateData.custom_role_id = validatedData.custom_role_id;
      }
      if (validatedData.can_access_all_patients !== undefined) {
        updateData.can_access_all_patients = validatedData.can_access_all_patients;
      }
      if (validatedData.assigned_chair !== undefined) {
        updateData.assigned_chair = validatedData.assigned_chair;
      }
      if (validatedData.schedule !== undefined) {
        updateData.schedule = validatedData.schedule;
      }
      if (validatedData.is_active !== undefined) {
        updateData.is_active = validatedData.is_active;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const legacyId = String(targetMember.id ?? targetMember.legacyId ?? memberId);
      // patchConvexDocumentByLegacyId encodes the patch (so the JSONB permission map in
      // custom_permissions is stored with encoded keys, matching the read branch which
      // decodeConvexValue()s it back).
      await patchConvexDocumentByLegacyId('clinic_users', legacyId, updateData);

      // Re-read so the response mirrors Supabase's `.update(...).select().single()`
      // (the persisted row with the patch applied). Decode JSONB back to canonical keys.
      const persisted = (await getConvexDocumentByLegacyId('clinic_users', legacyId)) as
        | ConvexRow
        | null;
      const updatedMember = persisted
        ? {
            ...persisted,
            custom_permissions: decodeConvexValue(persisted.custom_permissions),
          }
        : { ...targetMember, ...updateData };

      return NextResponse.json({
        success: true,
        member: updatedMember,
      });
    }

    // Get clinic and workspace
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

    // Get current user's workspace membership
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Or check clinic admin role
    const { data: currentClinicMember } = await supabaseAdmin
      .from('clinic_users')
      .select('role')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const canEdit =
      (currentMembership && ['owner', 'super_admin', 'admin'].includes(currentMembership.role)) ||
      (currentClinicMember && currentClinicMember.role === 'admin');

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit clinic members' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabaseAdmin
      .from('clinic_users')
      .select('id, user_id, clinic_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify target member belongs to same clinic
    if (targetMember.clinic_id !== clinicId) {
      return NextResponse.json(
        { error: 'Member not in this clinic' },
        { status: 403 }
      );
    }

    // Cannot modify yourself (role/is_active)
    if (targetMember.user_id === userId) {
      if (body.role || body.is_active === false) {
        return NextResponse.json(
          { error: 'Cannot modify your own role or deactivate yourself' },
          { status: 403 }
        );
      }
    }

    const { data: targetWorkspaceMember } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', targetMember.user_id)
      .eq('is_active', true)
      .single();

    if (targetWorkspaceMember?.role === 'owner') {
      const blockedFields = [
        'role',
        'custom_permissions',
        'custom_role_id',
        'is_active',
        'can_access_all_patients',
      ];
      const hasBlockedChange = blockedFields.some((field) => field in body);

      if (hasBlockedChange) {
        return NextResponse.json(
          { error: 'Cannot modify access for workspace owner' },
          { status: 403 }
        );
      }
    }

    // Parse and validate request body
    const validatedData = updateMemberSchema.parse(body);

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role;
    }

    if (validatedData.custom_permissions !== undefined) {
      updateData.custom_permissions = validatedData.custom_permissions;
    }

    if (validatedData.custom_role_id !== undefined) {
      updateData.custom_role_id = validatedData.custom_role_id;
    }

    if (validatedData.can_access_all_patients !== undefined) {
      updateData.can_access_all_patients = validatedData.can_access_all_patients;
    }

    if (validatedData.assigned_chair !== undefined) {
      updateData.assigned_chair = validatedData.assigned_chair;
    }

    if (validatedData.schedule !== undefined) {
      updateData.schedule = validatedData.schedule;
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
      .from('clinic_users')
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) {
      console.error('[clinic-members] Error updating member:', updateError);
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

    console.error('[clinic-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/clinic-members/[id]
 *
 * Remove a member from a clinic (deactivate).
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

    // Flag-gated Convex-only write branch. Runs ONLY after auth and the team.remove
    // permission guard. Supabase is unreachable here, so every access read + the soft
    // delete go through Convex. Mirrors the Supabase path exactly: it SOFT-deletes
    // (update is_active:false), so we patch is_active:false (NOT a hard delete) and
    // return the SAME { success, message } shape.
    if (shouldUseConvexOnlyWritePath('role_permissions')) {
      const workspaceId = await getClinicWorkspaceIdFromConvex(clinicId);
      if (!workspaceId) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }

      const currentWorkspaceRole = await getActiveWorkspaceRoleFromConvex(workspaceId, userId);
      const currentClinicRole = await getActiveClinicRoleFromConvex(clinicId, userId);

      const canRemove =
        (currentWorkspaceRole && ['owner', 'super_admin', 'admin'].includes(currentWorkspaceRole)) ||
        currentClinicRole === 'admin';

      if (!canRemove) {
        return NextResponse.json(
          { error: 'Insufficient permissions to remove clinic members' },
          { status: 403 }
        );
      }

      const targetMember = await getClinicMemberByIdFromConvex(memberId);

      if (!targetMember) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      if (String(targetMember.clinic_id) !== String(clinicId)) {
        return NextResponse.json({ error: 'Member not in this clinic' }, { status: 403 });
      }

      const targetWorkspaceRole = await getActiveWorkspaceRoleFromConvex(
        workspaceId,
        String(targetMember.user_id)
      );

      if (targetWorkspaceRole === 'owner') {
        return NextResponse.json(
          { error: 'Cannot remove workspace owner from clinic' },
          { status: 403 }
        );
      }

      if (String(targetMember.user_id) === String(userId)) {
        return NextResponse.json(
          { error: 'Cannot remove yourself from clinic' },
          { status: 403 }
        );
      }

      const legacyId = String(targetMember.id ?? targetMember.legacyId ?? memberId);
      await patchConvexDocumentByLegacyId('clinic_users', legacyId, { is_active: false });

      return NextResponse.json({
        success: true,
        message: 'Member removed from clinic',
      });
    }

    // Get clinic and workspace
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

    // Get current user's membership
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const { data: currentClinicMember } = await supabaseAdmin
      .from('clinic_users')
      .select('role')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const canRemove =
      (currentMembership && ['owner', 'super_admin', 'admin'].includes(currentMembership.role)) ||
      (currentClinicMember && currentClinicMember.role === 'admin');

    if (!canRemove) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove clinic members' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabaseAdmin
      .from('clinic_users')
      .select('id, user_id, clinic_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify target member belongs to same clinic
    if (targetMember.clinic_id !== clinicId) {
      return NextResponse.json(
        { error: 'Member not in this clinic' },
        { status: 403 }
      );
    }

    const { data: targetWorkspaceMember } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', targetMember.user_id)
      .eq('is_active', true)
      .single();

    if (targetWorkspaceMember?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove workspace owner from clinic' },
        { status: 403 }
      );
    }

    // Cannot remove yourself
    if (targetMember.user_id === userId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from clinic' },
        { status: 403 }
      );
    }

    // Deactivate member instead of deleting
    const { error: updateError } = await supabaseAdmin
      .from('clinic_users')
      .update({ is_active: false })
      .eq('id', memberId);

    if (updateError) {
      console.error('[clinic-members] Error removing member:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed from clinic',
    });
  } catch (error) {
    console.error('[clinic-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
