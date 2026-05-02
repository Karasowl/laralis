import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { WorkspaceMember, WorkspaceRole } from '@/lib/permissions';
import { readJson } from '@/lib/validation';

// Type for the user_profiles relation from Supabase query
interface UserProfileRelation {
  email: string | null;
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

    // Fetch all workspace members
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
        joined_at
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

    const userIds = (members || []).map((member) => member.user_id);
    const profilesById = new Map<string, UserProfileRelation>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('[workspace-members] Error fetching profiles:', profilesError);
      } else {
        (profiles || []).forEach((profile) => {
          profilesById.set(profile.id, {
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          });
        });
      }
    }

    const membersWithMissingProfile = userIds.filter((memberId) => {
      const profile = profilesById.get(memberId);
      return !profile?.email;
    });

    const missingProfileIds = Array.from(new Set(membersWithMissingProfile));
    const authFallbacks = new Map<string, UserProfileRelation>();

    if (missingProfileIds.length > 0) {
      const authResults = await Promise.all(
        missingProfileIds.map(async (memberId) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(memberId);
          const user = data?.user;

          if (!user) return null;

          const metadata = user.user_metadata as Record<string, unknown> | undefined;
          const fullName =
            typeof metadata?.full_name === 'string'
              ? metadata.full_name
              : typeof metadata?.name === 'string'
                ? metadata.name
                : null;
          const avatarUrl =
            typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null;

          return {
            userId: memberId,
            profile: {
              email: user.email || null,
              full_name: fullName,
              avatar_url: avatarUrl,
            },
          };
        })
      );

      authResults.forEach((result) => {
        if (result?.profile) {
          authFallbacks.set(result.userId, result.profile);
        }
      });
    }

    // Transform to expected format
    const transformedMembers: WorkspaceMember[] = (members || []).map((m) => {
      const profile = profilesById.get(m.user_id) || null;
      const fallbackProfile = authFallbacks.get(m.user_id) || null;
      const email = profile?.email || fallbackProfile?.email || '';
      const fullName = profile?.full_name ?? fallbackProfile?.full_name ?? null;
      const avatarUrl = profile?.avatar_url ?? fallbackProfile?.avatar_url ?? null;

      return {
        id: m.id,
        user_id: m.user_id,
        workspace_id: m.workspace_id,
        role: m.role as WorkspaceRole,
        custom_permissions: m.custom_permissions,
        custom_role_id: m.custom_role_id,
        allowed_clinics: m.allowed_clinics || [],
        is_active: m.is_active,
        joined_at: m.joined_at,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
      };
    });

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
  custom_role_id: z.string().uuid().nullable().optional(),
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
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
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
        clinic_ids: validatedData.allowed_clinics || [],
        custom_role_id: validatedData.custom_role_id || null,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: userId,
        custom_permissions: validatedData.custom_permissions || null,
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
