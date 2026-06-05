import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import {
  findAuthUserIdByEmail,
  getAuthUserProfileById,
} from '@/lib/auth-user-profiles';
import { listConvexDocumentsByWorkspace, decodeConvexValue } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

// Project a Convex invitations row to the EXACT column subset the Supabase
// .select() returns, decoding the two JSONB permission maps (stored with encoded
// keys in Convex) so the response is byte-identical.
function projectInvitationRow(row: ImportedRecord) {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    clinic_id: row.clinic_id,
    clinic_ids: row.clinic_ids,
    email: row.email,
    role: row.role,
    permissions: decodeConvexValue(row.permissions),
    custom_permissions: decodeConvexValue(row.custom_permissions),
    custom_role_id: row.custom_role_id,
    token: row.token,
    expires_at: row.expires_at,
    invited_by: row.invited_by,
    accepted_at: row.accepted_at,
    rejected_at: row.rejected_at,
    message: row.message,
    resent_count: row.resent_count,
    last_resent_at: row.last_resent_at,
    created_at: row.created_at,
  };
}

/**
 * GET /api/invitations
 *
 * List all pending invitations for the current workspace.
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const workspaceIdParam = searchParams.get('workspaceId');
  const statusParam = searchParams.get('status'); // pending, accepted, rejected, all

  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;
  const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.view');
  if (forbidden) return forbidden;

  try {
    // Get workspace ID
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

    // Verify user has access
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

    // Flag-gated Convex read branch. Reached only AFTER auth (resolveClinicContext),
    // the team.view permission guard, and the active workspace_users membership
    // check above. The Convex bridge has NO RLS, so that authorization MUST stay in
    // front. Replicates the workspace-scoped select + status filters + ordering.
    let invitations: ImportedRecord[] | null;
    if (shouldReturnConvexData('invitations')) {
      const now = new Date();
      const rows = (await listConvexDocumentsByWorkspace('invitations', workspaceId!, 10000) as ImportedRecord[])
        .map(normalizeConvexRecord)
        .filter((row) => {
          if (statusParam === 'pending') {
            return !row.accepted_at && !row.rejected_at && new Date(row.expires_at) > now;
          } else if (statusParam === 'accepted') {
            return Boolean(row.accepted_at);
          } else if (statusParam === 'rejected') {
            return Boolean(row.rejected_at);
          } else if (statusParam === 'expired') {
            return !row.accepted_at && !row.rejected_at && new Date(row.expires_at) < now;
          }
          return true;
        })
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
        .map(projectInvitationRow);
      invitations = rows;
    } else {
      // Build query. The inviter lives in auth.users, not in a user_profiles table.
      let query = supabaseAdmin
        .from('invitations')
        .select(`
          id,
          workspace_id,
          clinic_id,
          clinic_ids,
          email,
          role,
          permissions,
          custom_permissions,
          custom_role_id,
          token,
          expires_at,
          invited_by,
          accepted_at,
          rejected_at,
          message,
          resent_count,
          last_resent_at,
          created_at
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      // Filter by status
      if (statusParam === 'pending') {
        query = query
          .is('accepted_at', null)
          .is('rejected_at', null)
          .gt('expires_at', new Date().toISOString());
      } else if (statusParam === 'accepted') {
        query = query.not('accepted_at', 'is', null);
      } else if (statusParam === 'rejected') {
        query = query.not('rejected_at', 'is', null);
      } else if (statusParam === 'expired') {
        query = query
          .is('accepted_at', null)
          .is('rejected_at', null)
          .lt('expires_at', new Date().toISOString());
      }

      const result = await query;

      if (result.error) {
        console.error('[invitations] Error fetching invitations:', result.error);
        return NextResponse.json(
          { error: 'Failed to fetch invitations' },
          { status: 500 }
        );
      }
      invitations = result.data;
    }

    // Transform and add status
    const inviterIds = Array.from(
      new Set((invitations || []).map((inv) => inv.invited_by).filter(Boolean))
    );
    const inviterProfiles = new Map<string, Awaited<ReturnType<typeof getAuthUserProfileById>>>();
    await Promise.all(
      inviterIds.map(async (inviterId) => {
        inviterProfiles.set(inviterId, await getAuthUserProfileById(inviterId));
      })
    );

    const transformedInvitations = (invitations || []).map((inv) => {
      let status = 'pending';
      if (inv.accepted_at) {
        status = 'accepted';
      } else if (inv.rejected_at) {
        status = 'rejected';
      } else if (new Date(inv.expires_at) < new Date()) {
        status = 'expired';
      }

      return {
        ...inv,
        inviter: inviterProfiles.get(inv.invited_by) || null,
        status,
        // Don't expose full token in list
        token: undefined,
      };
    });

    return NextResponse.json({
      invitations: transformedInvitations,
      workspaceId,
    });
  } catch (error) {
    console.error('[invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Schema for creating an invitation
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'viewer', 'doctor', 'assistant', 'receptionist']),
  scope: z.enum(['workspace', 'clinic']).optional(),
  clinic_ids: z.array(z.string().uuid()).optional(),
  custom_permissions: z.record(z.boolean()).optional(),
  custom_role_id: z.string().uuid().nullable().optional(),
  message: z.string().max(500).optional(),
});

/**
 * POST /api/invitations
 *
 * Create a new invitation.
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
  const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.invite');
  if (forbidden) return forbidden;

  try {
    // Get workspace ID
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

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
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

    // Check if email already has an active invitation
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
        { error: 'An active invitation already exists for this email' },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingUserId = await findAuthUserIdByEmail(validatedData.email);

    if (existingUserId) {
      const { data: existingMember } = await supabaseAdmin
        .from('workspace_users')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUserId)
        .eq('is_active', true)
        .single();

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this workspace' },
          { status: 400 }
        );
      }
    }

    // Generate token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');

    // Set expiration (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const clinicRoles = ['admin', 'doctor', 'assistant', 'receptionist', 'viewer'];
    const workspaceRoles = ['admin', 'editor', 'viewer'];
    const legacyClinicRoles = ['doctor', 'assistant', 'receptionist'];
    const isClinicInvite =
      validatedData.scope === 'clinic' ||
      (!validatedData.scope && legacyClinicRoles.includes(validatedData.role));

    if (validatedData.scope === 'clinic' && !clinicRoles.includes(validatedData.role)) {
      return NextResponse.json(
        { error: 'Invalid role for clinic invitation' },
        { status: 400 }
      );
    }

    if (validatedData.scope === 'workspace' && !workspaceRoles.includes(validatedData.role)) {
      return NextResponse.json(
        { error: 'Invalid role for workspace invitation' },
        { status: 400 }
      );
    }

    const clinicIds =
      validatedData.clinic_ids && validatedData.clinic_ids.length > 0
        ? [...validatedData.clinic_ids]
        : isClinicInvite
          ? [clinicId]
          : [];

    if (isClinicInvite && !clinicIds.includes(clinicId)) {
      clinicIds.unshift(clinicId);
    }

    // Create invitation
    const { data: invitation, error: createError } = await supabaseAdmin
      .from('invitations')
      .insert({
        workspace_id: workspaceId,
        clinic_id: isClinicInvite ? clinicId : null,
        clinic_ids: clinicIds,
        email: validatedData.email,
        role: validatedData.role,
        custom_role_id: validatedData.custom_role_id || null,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: userId,
        permissions: {},
        custom_permissions: validatedData.custom_permissions || null,
        message: validatedData.message || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('[invitations] Error creating invitation:', createError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // TODO: Send invitation email
    // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
    // await sendInvitationEmail(validatedData.email, inviteUrl, ...);

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

    console.error('[invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invitations?id=xxx
 *
 * Cancel an invitation.
 */
export async function DELETE(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const invitationId = searchParams.get('id');

  if (!invitationId) {
    return NextResponse.json(
      { error: 'Missing invitation ID' },
      { status: 400 }
    );
  }

  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;
  const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'team.invite');
  if (forbidden) return forbidden;

  try {
    // Get workspace ID
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

    // Verify user can cancel
    const { data: membership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get invitation
    const { data: invitation } = await supabaseAdmin
      .from('invitations')
      .select('id, workspace_id, accepted_at')
      .eq('id', invitationId)
      .single();

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.workspace_id !== clinic.workspace_id) {
      return NextResponse.json(
        { error: 'Invitation not in this workspace' },
        { status: 403 }
      );
    }

    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'Cannot cancel an accepted invitation' },
        { status: 400 }
      );
    }

    // Delete invitation
    const { error: deleteError } = await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (deleteError) {
      console.error('[invitations] Error deleting invitation:', deleteError);
      return NextResponse.json(
        { error: 'Failed to cancel invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled',
    });
  } catch (error) {
    console.error('[invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
