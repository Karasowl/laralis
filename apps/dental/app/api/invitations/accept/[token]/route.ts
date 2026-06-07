import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUserProfileById } from '@/lib/auth-user-profiles';
import {
  listConvexTable,
  getConvexDocumentByLegacyId,
  listConvexDocumentsByWorkspace,
  listConvexDocumentsByClinic,
  upsertConvexDocumentByLegacyId,
  patchConvexDocumentByLegacyId,
} from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend';

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

// QA route contract: @qa-token-route public invitation lookup plus authenticated email-matched acceptance.
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
    // Public-by-token endpoint (the unguessable token is the only credential),
    // so the flag-gated Convex read branch needs no extra auth guard — it mirrors
    // exactly what the Supabase path exposes. invitations is looked up by its
    // unique token; workspaces/clinics are keyed by id (no clinic_id column).
    const useConvex = shouldReturnConvexData('invitations');

    // Get the invitation first. The inviter FK points to auth.users, so joining
    // user_profiles in this query makes valid invitations look missing.
    let invitation: ImportedRecord | null;
    if (useConvex) {
      const rows = (await listConvexTable('invitations', 10000) as ImportedRecord[]).map(normalizeConvexRecord);
      invitation = rows.find((r) => r && r.token === token) ?? null;
    } else {
      const { data, error } = await supabaseAdmin
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
          invited_by
        `)
        .eq('token', token)
        .single();

      if (error) {
        console.error('[invitations] Invitation lookup failed:', error);
      }
      invitation = data ?? null;
    }

    if (!invitation) {
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

    let workspace: { id: any; name: any } | null;
    let clinic: { id: any; name: any } | null;
    if (useConvex) {
      const wsDoc = invitation.workspace_id
        ? normalizeConvexRecord(await getConvexDocumentByLegacyId('workspaces', String(invitation.workspace_id)) as ImportedRecord | null)
        : null;
      workspace = wsDoc ? { id: wsDoc.id, name: wsDoc.name } : null;
      const clinicDoc = invitation.clinic_id
        ? normalizeConvexRecord(await getConvexDocumentByLegacyId('clinics', String(invitation.clinic_id)) as ImportedRecord | null)
        : null;
      clinic = clinicDoc ? { id: clinicDoc.id, name: clinicDoc.name } : null;
    } else {
      const [{ data: ws }, { data: cl }] = await Promise.all([
        supabaseAdmin
          .from('workspaces')
          .select('id, name')
          .eq('id', invitation.workspace_id)
          .maybeSingle(),
        invitation.clinic_id
          ? supabaseAdmin
              .from('clinics')
              .select('id, name')
              .eq('id', invitation.clinic_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      workspace = ws;
      clinic = cl;
    }

    const inviterProfile = invitation.invited_by
      ? await getAuthUserProfileById(invitation.invited_by)
      : null;

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        message: invitation.message,
        expires_at: invitation.expires_at,
        workspace,
        clinic,
        inviter: inviterProfile,
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
 * Convex-only port of POST accept. Replicates EVERY Supabase write the Supabase
 * path performs (workspace_users insert/reactivate, clinic_users insert/reactivate
 * for the primary clinic and each additional clinic in clinic_ids, and the
 * invitation accepted_at patch), reading prerequisites from Convex instead of
 * Supabase. Lookups use listConvex* + normalize because the migration bridge has
 * no RLS and rows carry legacy metadata. JSONB custom_permissions maps are encoded
 * by upsert/patch helpers (prepareConvexRow / encodeConvexValue), so we pass them
 * through unchanged. This runs only behind shouldUseConvexOnlyWritePath('invitations'),
 * after the auth + email-match guards in POST, so it inherits the same authorization.
 */
async function acceptInvitationInConvex(
  invitation: ImportedRecord,
  user: { id: string }
) {
  // Resolve custom role scope (if provided) — mirrors the Supabase
  // custom_role_templates lookup that decides workspace vs clinic placement.
  let customRoleScope: 'workspace' | 'clinic' | null = null;

  if (invitation.custom_role_id) {
    const roleTemplate = normalizeConvexRecord(
      (await getConvexDocumentByLegacyId(
        'custom_role_templates',
        String(invitation.custom_role_id)
      )) as ImportedRecord | null
    );

    if (roleTemplate && roleTemplate.workspace_id === invitation.workspace_id) {
      customRoleScope = roleTemplate.scope as 'workspace' | 'clinic';
    }
  }

  const workspaceCustomRoleId =
    customRoleScope === 'workspace' ? invitation.custom_role_id : null;
  const clinicCustomRoleId =
    customRoleScope === 'clinic' ? invitation.custom_role_id : null;

  const isClinicInvite = Boolean(invitation.clinic_id);

  // Check if already a workspace member (Convex parity of the
  // workspace_users .eq(workspace_id).eq(user_id).single() lookup).
  const workspaceMembers = (
    (await listConvexDocumentsByWorkspace(
      'workspace_users',
      String(invitation.workspace_id)
    )) as ImportedRecord[]
  ).map(normalizeConvexRecord);
  const existingMember =
    workspaceMembers.find(
      (m) =>
        m &&
        String(m.workspace_id) === String(invitation.workspace_id) &&
        String(m.user_id) === String(user.id)
    ) ?? null;

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
    // Create workspace membership (mirror the Supabase insert columns exactly).
    const id = crypto.randomUUID();
    try {
      await upsertConvexDocumentByLegacyId('workspace_users', id, {
        id,
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: workspaceRole,
        allowed_clinics: invitation.clinic_ids || [],
        custom_permissions: workspaceCustomPermissions,
        custom_role_id: workspaceCustomRoleId,
        is_active: true,
        joined_at: new Date().toISOString(),
      });
    } catch (wsError) {
      console.error('[invitations] Error creating workspace membership:', wsError);
      return NextResponse.json(
        { error: 'Failed to create workspace membership' },
        { status: 500 }
      );
    }
  } else {
    // Reactivate if inactive (mirror the conditional Supabase update payload).
    const workspaceUpdate: Record<string, unknown> = { is_active: true };

    if (!isClinicInvite) {
      workspaceUpdate.custom_permissions = workspaceCustomPermissions;
      workspaceUpdate.custom_role_id = workspaceCustomRoleId;
    } else if (workspaceCustomRoleId) {
      workspaceUpdate.custom_role_id = workspaceCustomRoleId;
    }

    await patchConvexDocumentByLegacyId(
      'workspace_users',
      String(existingMember.id),
      workspaceUpdate
    );
  }

  // Create clinic membership if this is a clinic-specific role.
  if (isClinicInvite && invitation.clinic_id) {
    const primaryClinicMembers = (
      (await listConvexDocumentsByClinic(
        'clinic_users',
        String(invitation.clinic_id)
      )) as ImportedRecord[]
    ).map(normalizeConvexRecord);
    const existingClinicMember =
      primaryClinicMembers.find(
        (m) =>
          m &&
          String(m.clinic_id) === String(invitation.clinic_id) &&
          String(m.user_id) === String(user.id)
      ) ?? null;

    if (!existingClinicMember) {
      const id = crypto.randomUUID();
      try {
        await upsertConvexDocumentByLegacyId('clinic_users', id, {
          id,
          clinic_id: invitation.clinic_id,
          user_id: user.id,
          role: invitation.role,
          custom_permissions: clinicCustomPermissions,
          custom_role_id: clinicCustomRoleId,
          is_active: true,
          can_access_all_patients: invitation.role === 'doctor',
          joined_at: new Date().toISOString(),
        });
      } catch (clinicError) {
        console.error('[invitations] Error creating clinic membership:', clinicError);
        return NextResponse.json(
          { error: 'Failed to create clinic membership' },
          { status: 500 }
        );
      }
    } else {
      await patchConvexDocumentByLegacyId(
        'clinic_users',
        String(existingClinicMember.id),
        {
          is_active: true,
          role: invitation.role,
          custom_permissions: clinicCustomPermissions,
          custom_role_id: clinicCustomRoleId,
        }
      );
    }
  }

  // Also add to any additional clinics specified.
  if (invitation.clinic_ids && invitation.clinic_ids.length > 0) {
    for (const clinicId of invitation.clinic_ids) {
      if (clinicId === invitation.clinic_id) continue; // Skip primary clinic

      const clinicMembers = (
        (await listConvexDocumentsByClinic(
          'clinic_users',
          String(clinicId)
        )) as ImportedRecord[]
      ).map(normalizeConvexRecord);
      const existingClinicMember =
        clinicMembers.find(
          (m) =>
            m &&
            String(m.clinic_id) === String(clinicId) &&
            String(m.user_id) === String(user.id)
        ) ?? null;

      if (!existingClinicMember) {
        const id = crypto.randomUUID();
        await upsertConvexDocumentByLegacyId('clinic_users', id, {
          id,
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

  // Mark invitation as accepted (mirror the Supabase accepted_at update;
  // best-effort, matching the Supabase path which does not fail on update error).
  try {
    await patchConvexDocumentByLegacyId('invitations', String(invitation.id), {
      accepted_at: new Date().toISOString(),
    });
  } catch (updateError) {
    console.error('[invitations] Error updating invitation:', updateError);
    // Don't fail - membership was created
  }

  return NextResponse.json({
    success: true,
    message: 'Invitation accepted successfully',
    workspace_id: invitation.workspace_id,
    clinic_id: invitation.clinic_id,
  });
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

  // In convex-only write mode Supabase is unreachable, so the invitation must be
  // read from Convex too (the by-token lookup mirrors the GET branch).
  const convexOnly = shouldUseConvexOnlyWritePath('invitations');

  try {
    // Get invitation
    let invitation: ImportedRecord | null;
    if (convexOnly) {
      const rows = (await listConvexTable('invitations', 10000) as ImportedRecord[]).map(normalizeConvexRecord);
      invitation = rows.find((r) => r && r.token === token) ?? null;
    } else {
      const { data, error: invError } = await supabaseAdmin
        .from('invitations')
        .select('*')
        .eq('token', token)
        .single();
      if (invError) {
        console.error('[invitations] Invitation lookup failed:', invError);
      }
      invitation = data ?? null;
    }

    if (!invitation) {
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

    // Convex-only write path: replicate every membership write + invitation patch
    // against Convex. The auth + email-match guards above already ran, so the
    // helper inherits the same authorization the Supabase path enforces.
    if (convexOnly) {
      return acceptInvitationInConvex(invitation, user);
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
