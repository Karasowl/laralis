import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { WorkspaceMember, WorkspaceRole } from '@/lib/permissions';

// Type for the user_profiles relation from Supabase query
interface UserProfileRelation {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * GET /api/team/workspace-members
 *
 * List all members of the current workspace.
 * Requires: team.view permission
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const workspaceIdParam = searchParams.get('workspaceId');

  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;

  try {
    // Get workspace ID from clinic or param
    let workspaceId = workspaceIdParam;

    if (!workspaceId) {
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

      workspaceId = clinic.workspace_id;
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Fetch all workspace members with user profile info
    const { data: members, error } = await supabaseAdmin
      .from('workspace_users')
      .select(`
        id,
        user_id,
        workspace_id,
        role,
        custom_permissions,
        custom_role_id,
        allowed_clinics,
        is_active,
        joined_at,
        user_profiles!inner (
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[workspace-members] Error fetching members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    // Transform to expected format
    const transformedMembers: WorkspaceMember[] = (members || []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      workspace_id: m.workspace_id,
      role: m.role as WorkspaceRole,
      custom_permissions: m.custom_permissions,
      custom_role_id: m.custom_role_id,
      allowed_clinics: m.allowed_clinics || [],
      is_active: m.is_active,
      joined_at: m.joined_at,
      email: (m.user_profiles as unknown as UserProfileRelation).email,
      full_name: (m.user_profiles as unknown as UserProfileRelation).full_name,
      avatar_url: (m.user_profiles as unknown as UserProfileRelation).avatar_url,
    }));

    return NextResponse.json({
      members: transformedMembers,
      workspaceId,
    });
  } catch (error) {
    console.error('[workspace-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Schema for creating a new invitation (which will become a workspace member)
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'viewer']),
  allowed_clinics: z.array(z.string().uuid()).optional(),
  custom_permissions: z.record(z.boolean()).optional(),
  message: z.string().optional(),
});

/**
 * POST /api/team/workspace-members
 *
 * Create an invitation for a new workspace member.
 * Requires: team.invite permission
 *
 * Note: This creates an invitation, not a direct member.
 * The user becomes a member when they accept the invitation.
 */
export async function POST(request: NextRequest) {
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

    // Verify user can invite
    const { data: membership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!membership || !['owner', 'super_admin', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to invite users' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createInvitationSchema.parse(body);

    // Check if user already exists in workspace
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', (
        await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('email', validatedData.email)
          .single()
      ).data?.id || '00000000-0000-0000-0000-000000000000')
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', validatedData.email)
      .is('accepted_at', null)
      .is('rejected_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'An invitation already exists for this email' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .insert({
        workspace_id: workspaceId,
        email: validatedData.email,
        role: validatedData.role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: userId,
        permissions: validatedData.custom_permissions || null,
        message: validatedData.message || null,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('[workspace-members] Error creating invitation:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // TODO: Send invitation email
    // await sendInvitationEmail(validatedData.email, token, workspaceId);

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
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
