import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { WorkspaceMember, WorkspaceRole } from '@/lib/permissions';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { readJson } from '@/lib/validation';
import {
  findAuthUserIdByEmail,
  getAuthUserProfilesByIds,
} from '@/lib/auth-user-profiles';
import {
  listConvexDocumentsByWorkspace,
  listConvexTable,
  decodeConvexValue,
} from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { getAuthBackend } from '@/lib/auth/convex-session';

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
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.view');
    if (forbidden) return forbidden;

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

    // Flag-gated Convex read branch. Reached only AFTER:
    //   1. resolveClinicContext (auth) succeeded,
    //   2. forbiddenIfMissingPermission(userId, clinicId, 'team.view') passed,
    //   3. the explicit workspace_users active-membership access check above passed.
    // The Convex bridge has NO RLS, so the caller authorization above MUST stay
    // before this branch. Default backend is Supabase; only flips when the
    // permissions/auth domain ('role_permissions') is routed to Convex.
    if (getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')) {
      // workspaceId is guaranteed non-null here: an active membership row was
      // just resolved for it (the access check above). Same value the Supabase
      // path uses below.
      const transformedMembers = await getWorkspaceMembersFromConvex(workspaceId!);
      return NextResponse.json({
        members: transformedMembers,
        workspaceId,
      });
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
    const profilesById = await getAuthUserProfilesByIds(userIds);

    // Transform to expected format
    const transformedMembers: WorkspaceMember[] = (members || []).map((m) => {
      const profile = profilesById.get(m.user_id) || null;
      const email = profile?.email || '';
      const fullName = profile?.full_name ?? null;
      const avatarUrl = profile?.avatar_url ?? null;

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

type ImportedRecord = Record<string, any>;

/**
 * Convex equivalent of the Supabase GET member-list query.
 *
 * Mirrors EXACTLY:
 *   supabaseAdmin.from('workspace_users')
 *     .select(id, user_id, workspace_id, role, custom_permissions,
 *             custom_role_id, allowed_clinics, is_active, joined_at)
 *     .eq('workspace_id', workspaceId)
 *     .order('joined_at', { ascending: true })
 *
 * Note: the member LIST query has NO is_active filter (only the caller's
 * access-check membership is active-gated). We preserve that: every
 * workspace_users row for the workspace is returned, active or not.
 *
 * Auth profiles (email / full_name / avatar_url) are resolved from the
 * mirrored `supabase_auth_users` table by id, replicating the exact
 * extraction performed by getAuthUserProfilesByIds -> profileFromUser
 * (which reads user.email and user.user_metadata.{full_name|name|avatar_url}).
 */
async function getWorkspaceMembersFromConvex(workspaceId: string): Promise<WorkspaceMember[]> {
  const [memberRows, authUserRows] = await Promise.all([
    listConvexDocumentsByWorkspace('workspace_users', workspaceId, 10000) as Promise<ImportedRecord[]>,
    listConvexTable('supabase_auth_users', 10000) as Promise<ImportedRecord[]>,
  ]);

  const authUserById = byId(authUserRows);

  return memberRows
    .filter((row) => String(row.workspace_id) === String(workspaceId))
    .sort((a, b) =>
      String(a.joined_at ?? '').localeCompare(String(b.joined_at ?? ''))
    )
    .map((m) => {
      const authUser = m.user_id ? authUserById.get(String(m.user_id)) : null;
      const profile = profileFromConvexAuthUser(authUser);

      return {
        id: m.id,
        user_id: m.user_id,
        workspace_id: m.workspace_id,
        role: m.role as WorkspaceRole,
        // custom_permissions JSONB keys are stored encoded in Convex; decode back
        // to canonical "resource.action" keys to match the Supabase response.
        custom_permissions: decodeConvexValue(m.custom_permissions),
        custom_role_id: m.custom_role_id,
        allowed_clinics: m.allowed_clinics || [],
        is_active: m.is_active,
        joined_at: m.joined_at,
        email: profile.email || '',
        full_name: profile.full_name ?? null,
        avatar_url: profile.avatar_url ?? null,
      } as WorkspaceMember;
    });
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id));
      return ids.map((id) => [id, row] as const);
    })
  );
}

/**
 * Replicates lib/auth-user-profiles.ts -> profileFromUser EXACTLY, but reading
 * from the mirrored supabase_auth_users row (which is the full Supabase auth
 * user object serialized via JSON during sync, so it carries `email` and
 * `user_metadata`).
 */
function profileFromConvexAuthUser(user: ImportedRecord | null | undefined): {
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
} {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;

  return {
    email: user?.email || null,
    full_name:
      typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.name === 'string'
          ? metadata.name
          : null,
    avatar_url: typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null,
  };
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
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.invite');
    if (forbidden) return forbidden;

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
    const existingUserId = await findAuthUserIdByEmail(validatedData.email);
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', existingUserId || '00000000-0000-0000-0000-000000000000')
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
