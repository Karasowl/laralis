import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
      const body = await request.json();
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
    const body = await request.json();
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
