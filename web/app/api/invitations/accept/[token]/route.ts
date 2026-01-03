import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/invitations/accept/[token]
 *
 * Get invitation details for display on the accept page.
 * This is a public endpoint (no auth required).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Get invitation with workspace and clinic info
    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .select(`
        id,
        workspace_id,
        clinic_id,
        clinic_ids,
        email,
        role,
        message,
        expires_at,
        accepted_at,
        rejected_at,
        workspace:workspaces (
          id,
          name
        ),
        clinic:clinics (
          id,
          name
        ),
        inviter:user_profiles!invitations_invited_by_fkey (
          full_name,
          email
        )
      `)
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if already handled
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'Invitation already accepted', status: 'accepted' },
        { status: 400 }
      );
    }

    if (invitation.rejected_at) {
      return NextResponse.json(
        { error: 'Invitation was rejected', status: 'rejected' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired', status: 'expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        message: invitation.message,
        expires_at: invitation.expires_at,
        workspace: invitation.workspace,
        clinic: invitation.clinic,
        inviter: invitation.inviter,
      },
    });
  } catch (error) {
    console.error('[invitations] Error fetching invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invitations/accept/[token]
 *
 * Accept an invitation. User must be authenticated.
 * Creates workspace_users and/or clinic_users records.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    // Get invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if already handled
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'Invitation already accepted' },
        { status: 400 }
      );
    }

    if (invitation.rejected_at) {
      return NextResponse.json(
        { error: 'Invitation was rejected' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Verify email matches (case insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'Email mismatch. Please sign in with the email address the invitation was sent to.',
          expected_email: invitation.email,
        },
        { status: 403 }
      );
    }

    // Resolve custom role scope (if provided)
    let customRoleScope: 'workspace' | 'clinic' | null = null;

    if (invitation.custom_role_id) {
      const { data: roleTemplate } = await supabaseAdmin
        .from('custom_role_templates')
        .select('scope, workspace_id')
        .eq('id', invitation.custom_role_id)
        .single();

      if (roleTemplate && roleTemplate.workspace_id === invitation.workspace_id) {
        customRoleScope = roleTemplate.scope as 'workspace' | 'clinic';
      }
    }

    const workspaceCustomRoleId =
      customRoleScope === 'workspace' ? invitation.custom_role_id : null;
    const clinicCustomRoleId =
      customRoleScope === 'clinic' ? invitation.custom_role_id : null;

    const isClinicInvite = Boolean(invitation.clinic_id);

    // Check if already a workspace member
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', user.id)
      .single();

    // Determine workspace role (clinic invites map to editor by default)
    const workspaceRole = isClinicInvite
      ? invitation.role === 'viewer'
        ? 'viewer'
        : 'editor'
      : invitation.role;
    const workspaceCustomPermissions = isClinicInvite
      ? null
      : invitation.custom_permissions;
    const clinicCustomPermissions = isClinicInvite
      ? invitation.custom_permissions
      : null;

    if (!existingMember) {
      // Create workspace membership
      const { error: wsError } = await supabaseAdmin
        .from('workspace_users')
        .insert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: workspaceRole,
          allowed_clinics: invitation.clinic_ids || [],
          custom_permissions: workspaceCustomPermissions,
          custom_role_id: workspaceCustomRoleId,
          is_active: true,
          joined_at: new Date().toISOString(),
        });

      if (wsError) {
        console.error('[invitations] Error creating workspace membership:', wsError);
        return NextResponse.json(
          { error: 'Failed to create workspace membership' },
          { status: 500 }
        );
      }
    } else {
      // Reactivate if inactive
      const workspaceUpdate: Record<string, unknown> = { is_active: true };

      if (!isClinicInvite) {
        workspaceUpdate.custom_permissions = workspaceCustomPermissions;
        workspaceUpdate.custom_role_id = workspaceCustomRoleId;
      } else if (workspaceCustomRoleId) {
        workspaceUpdate.custom_role_id = workspaceCustomRoleId;
      }

      await supabaseAdmin
        .from('workspace_users')
        .update(workspaceUpdate)
        .eq('id', existingMember.id);
    }

    // Create clinic membership if this is a clinic-specific role
    if (isClinicInvite && invitation.clinic_id) {
      // Check if already a clinic member
      const { data: existingClinicMember } = await supabaseAdmin
        .from('clinic_users')
        .select('id')
        .eq('clinic_id', invitation.clinic_id)
        .eq('user_id', user.id)
        .single();

      if (!existingClinicMember) {
        const { error: clinicError } = await supabaseAdmin
          .from('clinic_users')
          .insert({
            clinic_id: invitation.clinic_id,
            user_id: user.id,
            role: invitation.role,
            custom_permissions: clinicCustomPermissions,
            custom_role_id: clinicCustomRoleId,
            is_active: true,
            can_access_all_patients: invitation.role === 'doctor',
            joined_at: new Date().toISOString(),
          });

        if (clinicError) {
          console.error('[invitations] Error creating clinic membership:', clinicError);
          return NextResponse.json(
            { error: 'Failed to create clinic membership' },
            { status: 500 }
          );
        }
      } else {
        // Reactivate if inactive
        await supabaseAdmin
          .from('clinic_users')
          .update({
            is_active: true,
            role: invitation.role,
            custom_permissions: clinicCustomPermissions,
            custom_role_id: clinicCustomRoleId,
          })
          .eq('id', existingClinicMember.id);
      }
    }

    // Also add to any additional clinics specified
    if (invitation.clinic_ids && invitation.clinic_ids.length > 0) {
      for (const clinicId of invitation.clinic_ids) {
        if (clinicId === invitation.clinic_id) continue; // Skip primary clinic

        const { data: existingClinicMember } = await supabaseAdmin
          .from('clinic_users')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('user_id', user.id)
          .single();

        if (!existingClinicMember) {
          await supabaseAdmin
            .from('clinic_users')
            .insert({
              clinic_id: clinicId,
              user_id: user.id,
              role: invitation.role,
              custom_permissions: clinicCustomPermissions,
              custom_role_id: clinicCustomRoleId,
              is_active: true,
              can_access_all_patients: invitation.role === 'doctor',
              joined_at: new Date().toISOString(),
            });
        }
      }
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from('invitations')
      .update({
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('[invitations] Error updating invitation:', updateError);
      // Don't fail - membership was created
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      workspace_id: invitation.workspace_id,
      clinic_id: invitation.clinic_id,
    });
  } catch (error) {
    console.error('[invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
