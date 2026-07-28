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
  getConvexDocumentByLegacyId,
  listConvexDocumentsByWorkspace,
  listConvexTable,
  decodeConvexValue,
  upsertConvexDocumentByLegacyId,
  userHasActiveWorkspaceMembershipFromConvex,
} from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend';
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

    // Flag-gated Convex read branch. Reached only AFTER:
    //   1. resolveClinicContext (auth) succeeded,
    //   2. forbiddenIfMissingPermission(userId, clinicId, 'team.view') passed.
    // This branch MUST run BEFORE any supabaseAdmin call: in convex-only mode
    // Supabase is unreachable, so the workspace resolution and access check
    // below would 500. It mirrors the same workspace resolution (param ->
    // clinic.workspace_id), the same active-membership access check, and the
    // same member-list query — all against Convex.
    // The Convex bridge has NO RLS, so the active-membership access check is
    // replicated here before the data read. Default backend is Supabase; only
    // flips when the permissions/auth domain ('role_permissions') is routed to
    // Convex.
    if (getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')) {
      // Resolve workspace ID from param or from clinic.workspace_id (Convex).
      let convexWorkspaceId = workspaceIdParam;
      if (!convexWorkspaceId) {
        const clinic = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
          | { workspace_id?: string | null }
          | null;
        if (!clinic) {
          return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
        }
        convexWorkspaceId = clinic.workspace_id ?? null;
      }

      if (!convexWorkspaceId) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }

      // Replicate the active-membership access check (no RLS on the bridge).
      const hasActiveMembership = await userHasActiveWorkspaceMembershipFromConvex(
        convexWorkspaceId,
        userId
      );
      if (!hasActiveMembership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const transformedMembers = await getWorkspaceMembersFromConvex(convexWorkspaceId);
      return NextResponse.json({
        members: transformedMembers,
        workspaceId: convexWorkspaceId,
      });
    }

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

    // Flag-gated Convex-only write branch. Reached only AFTER:
    //   1. resolveClinicContext (auth) succeeded,
    //   2. forbiddenIfMissingPermission(userId, clinicId, 'team.invite') passed.
    // In convex-only write mode Supabase is unreachable, so EVERY supabaseAdmin
    // read/write below (clinic resolution, role check, duplicate checks, and the
    // invitations insert) would throw. This branch replicates them all against
    // Convex BEFORE the first Supabase call and mirrors the SINGLE Supabase write
    // (insert one `invitations` row). It keeps the Supabase path intact for the
    // default backend. The bridge has no RLS, so the same role-based access gate
    // is replicated here before the write.
    if (shouldUseConvexOnlyWritePath('role_permissions')) {
      return createWorkspaceInvitationInConvex(request, clinicId, userId);
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

/**
 * Convex-only write port of the POST handler. Replicates EVERY Supabase
 * operation the Supabase path performs, in the same order, against Convex:
 *
 *   1. clinic.workspace_id            -> getConvexDocumentByLegacyId('clinics')
 *   2. caller's active membership+role-> listConvexDocumentsByWorkspace('workspace_users')
 *   3. existing-member duplicate check-> resolve email via mirrored
 *                                        supabase_auth_users + workspace_users scan
 *   4. existing-invitation duplicate  -> listConvexDocumentsByWorkspace('invitations')
 *   5. INSERT one `invitations` row   -> upsertConvexDocumentByLegacyId('invitations')
 *
 * Matches the Supabase response shape/status exactly. crypto.randomUUID() for the
 * id, ISO-8601 strings for expires_at (mirroring expiresAt.toISOString()). The
 * `custom_permissions` JSONB map is encoded automatically by
 * upsertConvexDocumentByLegacyId -> prepareConvexRow -> encodeConvexValue, matching
 * the decodeConvexValue applied by the convex read branches.
 */
async function createWorkspaceInvitationInConvex(
  request: NextRequest,
  clinicId: string,
  userId: string
): Promise<NextResponse> {
  // 1. Resolve workspace ID from clinic.
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

  // 2. Verify the caller has an active membership with an invite-capable role.
  //    Mirrors: workspace_users.eq(workspace_id).eq(user_id).eq(is_active,true)
  //    + role in ['owner','super_admin','admin'].
  const workspaceUserRows = (await listConvexDocumentsByWorkspace(
    'workspace_users',
    workspaceId,
    10000
  )) as ImportedRecord[];

  const membership = workspaceUserRows.find(
    (row) =>
      String(row.workspace_id) === String(workspaceId) &&
      String(row.user_id) === String(userId) &&
      row.is_active === true
  );

  if (!membership || !['owner', 'super_admin', 'admin'].includes(String(membership.role))) {
    return NextResponse.json(
      { error: 'Insufficient permissions to invite users' },
      { status: 403 }
    );
  }

  // 3. Parse and validate request body (same as the Supabase path).
  const bodyResult = await readJson(request);
  if ('error' in bodyResult) {
    return bodyResult.error;
  }
  const validatedData = createInvitationSchema.parse(bodyResult.data);

  // 4. Reject if the user is already a workspace member.
  //    Resolve the auth user id by email from the mirrored supabase_auth_users
  //    table (findAuthUserIdByEmail uses supabaseAdmin.auth.admin and is
  //    unreachable in convex-only mode), then scan workspace_users.
  const existingUserId = await findConvexAuthUserIdByEmail(validatedData.email);
  if (existingUserId) {
    const alreadyMember = workspaceUserRows.some(
      (row) =>
        String(row.workspace_id) === String(workspaceId) &&
        String(row.user_id) === String(existingUserId)
    );
    if (alreadyMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      );
    }
  }

  // 5. Reject if there is already a pending (non-accepted, non-rejected,
  //    non-expired) invitation for this email.
  const nowIso = new Date().toISOString();
  const invitationRows = (await listConvexDocumentsByWorkspace(
    'invitations',
    workspaceId,
    10000
  )) as ImportedRecord[];

  const existingInvitation = invitationRows.find(
    (row) =>
      String(row.workspace_id) === String(workspaceId) &&
      String(row.email) === String(validatedData.email) &&
      (row.accepted_at === null || row.accepted_at === undefined) &&
      (row.rejected_at === null || row.rejected_at === undefined) &&
      typeof row.expires_at === 'string' &&
      row.expires_at > nowIso
  );

  if (existingInvitation) {
    return NextResponse.json(
      { error: 'An invitation already exists for this email' },
      { status: 400 }
    );
  }

  // 6. Generate token (matches the Supabase path) and a 7-day expiry.
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 7. INSERT one invitations row. Same columns the Supabase insert writes.
  const id = crypto.randomUUID();
  const expiresAtIso = expiresAt.toISOString();
  await upsertConvexDocumentByLegacyId('invitations', id, {
    id,
    workspace_id: workspaceId,
    email: validatedData.email,
    role: validatedData.role,
    clinic_ids: validatedData.allowed_clinics || [],
    custom_role_id: validatedData.custom_role_id || null,
    token,
    expires_at: expiresAtIso,
    invited_by: userId,
    custom_permissions: validatedData.custom_permissions || null,
    message: validatedData.message || null,
  });

  return NextResponse.json({
    success: true,
    invitation: {
      id,
      email: validatedData.email,
      role: validatedData.role,
      expires_at: expiresAtIso,
    },
  });
}

/**
 * Convex equivalent of findAuthUserIdByEmail: resolve the auth user id by email
 * from the mirrored supabase_auth_users table (the GET read branch uses the same
 * source). Case-insensitive match, mirroring findAuthUserIdByEmail's normalize.
 * Returns null when no auth user matches.
 */
async function findConvexAuthUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const authUserRows = (await listConvexTable('supabase_auth_users', 10000)) as ImportedRecord[];
  const match = authUserRows.find(
    (row) => typeof row.email === 'string' && row.email.toLowerCase() === normalized
  );
  if (!match) return null;

  const resolvedId = match.id ?? match.legacyId ?? null;
  return resolvedId !== null && resolvedId !== undefined ? String(resolvedId) : null;
}
