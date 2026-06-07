import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ClinicMember, ClinicRole, WorkspaceRole } from '@/lib/permissions';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { readJson } from '@/lib/validation';
import { getAuthUserProfilesByIds, type AuthUserProfile } from '@/lib/auth-user-profiles';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend';
import { getAuthBackend } from '@/lib/auth/convex-session';
import {
  getConvexDocumentByLegacyId,
  listConvexDocumentsByClinic,
  listConvexDocumentsByWorkspace,
  listConvexTable,
  decodeConvexValue,
  convexUserHasClinicAccess,
  userHasActiveWorkspaceMembershipFromConvex,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server';

/**
 * GET /api/team/clinic-members
 *
 * List all members of a specific clinic.
 * Query params:
 * - clinicId: Optional, defaults to current clinic
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const clinicIdParam = searchParams.get('clinicId');

  const context = await resolveClinicContext({
    requestedClinicId: clinicIdParam,
    cookieStore,
  });

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

    // Flag-gated Convex authorization + read branch. Runs ONLY after auth
    // (resolveClinicContext) and the team.view permission guard. The Convex bridge has
    // NO RLS, so the caller access check (is_clinic_member OR active workspace
    // membership) is replicated here against Convex BEFORE the member-list read. In
    // convex-only mode Supabase is unreachable, so this MUST precede the supabaseAdmin
    // calls below (which would otherwise 500).
    if (getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')) {
      const clinicDoc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
        | { workspace_id?: string | null }
        | null;
      if (!clinicDoc) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }
      const workspaceId = clinicDoc.workspace_id ? String(clinicDoc.workspace_id) : '';

      // Parity with the Supabase access gate: is_clinic_member OR active workspace member.
      const isClinicMember = await convexUserHasClinicAccess(userId, clinicId);
      const isWorkspaceMember = workspaceId
        ? await userHasActiveWorkspaceMembershipFromConvex(workspaceId, userId)
        : false;
      if (!isClinicMember && !isWorkspaceMember) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const transformedMembers = await getClinicMembersFromConvex(clinicId, workspaceId);
      return NextResponse.json({
        members: transformedMembers,
        clinicId,
      });
    }

    // Verify user has access to this clinic
    const { data: accessCheck } = await supabaseAdmin.rpc(
      'is_clinic_member',
      { p_clinic_id: clinicId }
    );

    // Fallback: check workspace membership
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

    const { data: workspaceMember } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!accessCheck && !workspaceMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Fetch all clinic members
    const { data: members, error } = await supabaseAdmin
      .from('clinic_users')
      .select(`
        id,
        user_id,
        clinic_id,
        role,
        custom_permissions,
        custom_role_id,
        is_active,
        joined_at,
        can_access_all_patients,
        assigned_chair,
        schedule
      `)
      .eq('clinic_id', clinicId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[clinic-members] Error fetching members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    const userIds = (members || []).map((member) => member.user_id);
    const workspaceRolesByUser = new Map<string, WorkspaceRole>();

    if (userIds.length > 0) {
      const { data: workspaceMembers, error: workspaceMembersError } =
        await supabaseAdmin
          .from('workspace_users')
          .select('user_id, role')
          .eq('workspace_id', clinic.workspace_id)
          .in('user_id', userIds);

      if (workspaceMembersError) {
        console.error('[clinic-members] Error fetching workspace roles:', workspaceMembersError);
      } else {
        (workspaceMembers || []).forEach((workspaceMember) => {
          workspaceRolesByUser.set(
            workspaceMember.user_id,
            workspaceMember.role as WorkspaceRole
          );
        });
      }
    }
    const authProfilesById = await getAuthUserProfilesByIds(userIds);

    // Transform to expected format
    const transformedMembers: ClinicMember[] = (members || []).map((m) => {
      const profile = authProfilesById.get(m.user_id) || null;
      const email = profile?.email || '';
      const fullName = profile?.full_name ?? null;
      const avatarUrl = profile?.avatar_url ?? null;

      return {
        id: m.id,
        user_id: m.user_id,
        clinic_id: m.clinic_id,
        role: m.role as ClinicRole,
        workspace_role: workspaceRolesByUser.get(m.user_id) || null,
        custom_permissions: m.custom_permissions,
        custom_role_id: m.custom_role_id,
        is_active: m.is_active,
        joined_at: m.joined_at,
        can_access_all_patients: m.can_access_all_patients,
        assigned_chair: m.assigned_chair,
        schedule: m.schedule as Record<string, unknown> | null,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
      };
    });

    return NextResponse.json({
      members: transformedMembers,
      clinicId,
    });
  } catch (error) {
    console.error('[clinic-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const {
    _id,
    _creationTime,
    legacyId,
    legacyTable,
    convex_created_at,
    convex_updated_at,
    convex_snapshot_source,
    ...rest
  } = row;
  return rest;
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id));
      return ids.map((id) => [id, row] as const);
    })
  );
}

// Mirror of profileFromUser() in lib/auth-user-profiles.ts. The Supabase path resolves
// member email/name/avatar via supabase.auth.admin.getUserById(); the Convex mirror table
// supabase_auth_users stores the same JSON-serialized auth user object (id, email,
// user_metadata), so we read the SAME fields here.
function profileFromMirroredAuthUser(user: ImportedRecord | null | undefined): AuthUserProfile | null {
  if (!user) return null;
  const metadata = (user.user_metadata ?? user.raw_user_meta_data) as
    | Record<string, unknown>
    | undefined;

  return {
    email: typeof user.email === 'string' ? user.email : null,
    full_name:
      typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.name === 'string'
          ? metadata.name
          : null,
    avatar_url: typeof metadata?.avatar_url === 'string' ? metadata.avatar_url : null,
  };
}

/**
 * Convex equivalent of the Supabase clinic-members assembly.
 * - clinic_users membership rows (FK clinic_id) come from the mirrored clinic_users table.
 * - workspace role per member (FK workspace_id + user_id) from the mirrored workspace_users table.
 * - auth profile (email/full_name/avatar_url) per member from the mirrored supabase_auth_users table by id.
 * Produces a byte-identical ClinicMember[] shape vs the Supabase branch.
 */
async function getClinicMembersFromConvex(
  clinicId: string,
  workspaceId: string
): Promise<ClinicMember[]> {
  const [clinicUserRows, workspaceUserRows, authUserRows] = await Promise.all([
    listConvexDocumentsByClinic('clinic_users', clinicId) as Promise<ImportedRecord[]>,
    listConvexDocumentsByWorkspace('workspace_users', workspaceId) as Promise<ImportedRecord[]>,
    listConvexTable('supabase_auth_users', 10000) as Promise<ImportedRecord[]>,
  ]);

  // Match the Supabase ordering: joined_at ascending.
  const members = [...clinicUserRows].sort((a, b) =>
    String(a.joined_at ?? '').localeCompare(String(b.joined_at ?? ''))
  );

  const userIds = members.map((member) => String(member.user_id));

  const workspaceRolesByUser = new Map<string, WorkspaceRole>();
  for (const workspaceUser of workspaceUserRows) {
    if (userIds.includes(String(workspaceUser.user_id))) {
      workspaceRolesByUser.set(
        String(workspaceUser.user_id),
        workspaceUser.role as WorkspaceRole
      );
    }
  }

  const authUserById = byId(authUserRows);
  const authProfilesById = new Map<string, AuthUserProfile>();
  for (const userId of userIds) {
    const profile = profileFromMirroredAuthUser(authUserById.get(userId));
    if (profile) authProfilesById.set(userId, profile);
  }

  return members.map((m) => {
    const profile = authProfilesById.get(String(m.user_id)) || null;
    const email = profile?.email || '';
    const fullName = profile?.full_name ?? null;
    const avatarUrl = profile?.avatar_url ?? null;

    return {
      id: m.id,
      user_id: m.user_id,
      clinic_id: m.clinic_id,
      role: m.role as ClinicRole,
      workspace_role: workspaceRolesByUser.get(String(m.user_id)) || null,
      // custom_permissions JSONB keys are stored encoded in Convex; decode back
      // to canonical "resource.action" keys to match the Supabase response.
      custom_permissions: decodeConvexValue(m.custom_permissions) as ClinicMember['custom_permissions'],
      custom_role_id: m.custom_role_id,
      is_active: m.is_active,
      joined_at: m.joined_at,
      can_access_all_patients: m.can_access_all_patients,
      assigned_chair: m.assigned_chair,
      schedule: m.schedule as Record<string, unknown> | null,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
    };
  });
}

// Schema for adding a user to a clinic
const addMemberSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'doctor', 'assistant', 'receptionist', 'viewer']),
  custom_permissions: z.record(z.boolean()).optional(),
  custom_role_id: z.string().uuid().nullable().optional(),
  can_access_all_patients: z.boolean().optional(),
  assigned_chair: z.string().optional(),
});

/**
 * POST /api/team/clinic-members
 *
 * Add an existing workspace user to a specific clinic.
 * The user must already be a member of the workspace.
 */
export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const clinicIdParam = searchParams.get('clinicId');

  const context = await resolveClinicContext({
    requestedClinicId: clinicIdParam,
    cookieStore,
  });

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

    // Flag-gated Convex-only write branch. Runs ONLY after auth (resolveClinicContext)
    // and the team.edit_roles permission guard. In convex-only mode Supabase is
    // unreachable, so every Supabase read + the clinic_users insert below would 500;
    // this branch replicates them against Convex BEFORE the first supabaseAdmin call.
    if (shouldUseConvexOnlyWritePath('role_permissions')) {
      return addClinicMemberInConvex(request, clinicId, userId);
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

    // Verify current user can add members
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!currentMembership || !['owner', 'super_admin', 'admin'].includes(currentMembership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to add clinic members' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    const validatedData = addMemberSchema.parse(body);

    // Verify target user is in workspace
    const { data: targetWorkspaceMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id, is_active')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', validatedData.user_id)
      .single();

    if (!targetWorkspaceMember || !targetWorkspaceMember.is_active) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 400 }
      );
    }

    // Check if user already in clinic
    const { data: existingMember } = await supabaseAdmin
      .from('clinic_users')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('user_id', validatedData.user_id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this clinic' },
        { status: 400 }
      );
    }

    // Add user to clinic
    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('clinic_users')
      .insert({
        clinic_id: clinicId,
        user_id: validatedData.user_id,
        role: validatedData.role,
        custom_permissions: validatedData.custom_permissions || null,
        custom_role_id: validatedData.custom_role_id || null,
        can_access_all_patients: validatedData.can_access_all_patients ?? false,
        assigned_chair: validatedData.assigned_chair || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[clinic-members] Error adding member:', insertError);
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      member: newMember,
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
 * Convex-only port of the POST add-clinic-member handler. Mirrors the Supabase path
 * step-for-step against the mirrored Convex tables:
 *   1. clinic (workspace_id)                  -> getConvexDocumentByLegacyId('clinics')
 *   2. caller's active workspace membership    -> workspace_users by workspace + user
 *   3. target user's active workspace membership
 *   4. existing clinic_users membership (dedupe)
 *   5. insert one clinic_users row             -> upsertConvexDocumentByLegacyId('clinic_users')
 * DB-default columns the Supabase INSERT relies on (id, joined_at, created_at, updated_at,
 * schedule '{}') are stamped explicitly here so the returned row matches `.select().single()`.
 * The custom_permissions JSONB map is passed raw to the upsert: prepareConvexRow encodes
 * every object key (the GET read branch round-trips it back via decodeConvexValue), while
 * the HTTP response returns the un-encoded local row to keep the Supabase shape.
 * Returns the same { success, member } / error shapes + statuses as the Supabase branch.
 */
async function addClinicMemberInConvex(
  request: NextRequest,
  clinicId: string,
  userId: string
) {
  try {
    // 1. Get clinic and workspace.
    const clinicDoc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
      | { workspace_id?: string | null }
      | null;
    if (!clinicDoc) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
    }
    const workspaceId = clinicDoc.workspace_id ? String(clinicDoc.workspace_id) : '';

    const workspaceUserRows = (await listConvexDocumentsByWorkspace(
      'workspace_users',
      workspaceId
    )) as ImportedRecord[];

    // 2. Verify current user can add members (active workspace member with elevated role).
    const currentMembership = workspaceUserRows.find(
      (row) => String(row.user_id) === String(userId) && row.is_active === true
    );
    if (
      !currentMembership ||
      !['owner', 'super_admin', 'admin'].includes(String(currentMembership.role))
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions to add clinic members' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body.
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    const validatedData = addMemberSchema.parse(body);

    // 4. Verify target user is an active member of the workspace.
    const targetWorkspaceMember = workspaceUserRows.find(
      (row) => String(row.user_id) === String(validatedData.user_id)
    );
    if (!targetWorkspaceMember || targetWorkspaceMember.is_active !== true) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 400 }
      );
    }

    // 5. Check if user already in clinic.
    const existingClinicRows = (await listConvexDocumentsByClinic(
      'clinic_users',
      clinicId
    )) as ImportedRecord[];
    const existingMember = existingClinicRows.find(
      (row) => String(row.user_id) === String(validatedData.user_id)
    );
    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this clinic' },
        { status: 400 }
      );
    }

    // 6. Insert clinic_users row. DB-default columns are stamped explicitly so the
    // returned row matches the Supabase `.select().single()` response.
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMember = {
      id,
      clinic_id: clinicId,
      user_id: validatedData.user_id,
      role: validatedData.role,
      custom_permissions: validatedData.custom_permissions || null,
      custom_role_id: validatedData.custom_role_id || null,
      can_access_all_patients: validatedData.can_access_all_patients ?? false,
      assigned_chair: validatedData.assigned_chair || null,
      schedule: {},
      is_active: true,
      joined_at: now,
      created_at: now,
      updated_at: now,
    };

    // custom_permissions JSONB keys are encoded by prepareConvexRow inside the upsert
    // (the GET branch decodes them back); the HTTP response returns the raw local row.
    await upsertConvexDocumentByLegacyId('clinic_users', id, newMember);

    return NextResponse.json({
      success: true,
      member: newMember,
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
