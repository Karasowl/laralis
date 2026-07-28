import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import {
  getConvexDocumentByLegacyId,
  patchConvexDocumentByLegacyId,
  userHasActiveWorkspaceMembershipFromConvex,
} from '@/lib/convex/server';
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend';

/**
 * POST /api/invitations/[id]/resend
 *
 * Resend an invitation by generating a new token and extending expiration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params;
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
    // Flag-gated Convex-only write branch. Reached only AFTER auth
    // (resolveClinicContext) and the team.invite permission guard above. The Convex
    // bridge has NO RLS, so the active-workspace-membership authorization check stays
    // in front of every read/write, mirroring the Supabase path's membership gate. In
    // convex-only mode Supabase is unreachable, so this MUST precede any supabaseAdmin
    // call. Replicates the same multi-step flow: resolve workspace from clinic, verify
    // membership, load the invitation, apply the same status/limit guards, then patch
    // token + expires_at + resent_count + last_resent_at.
    if (shouldUseConvexOnlyWritePath('invitations')) {
      const clinicDoc = (await getConvexDocumentByLegacyId('clinics', clinicId)) as
        | { workspace_id?: string | null }
        | null;

      if (!clinicDoc) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }

      const workspaceId = clinicDoc.workspace_id ? String(clinicDoc.workspace_id) : null;

      if (!workspaceId || !(await userHasActiveWorkspaceMembershipFromConvex(workspaceId, userId))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const invitationDoc = (await getConvexDocumentByLegacyId('invitations', invitationId)) as
        | {
            id?: string;
            email?: string | null;
            workspace_id?: string | null;
            accepted_at?: string | null;
            rejected_at?: string | null;
            resent_count?: number | null;
          }
        | null;

      if (!invitationDoc) {
        return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
      }

      if (String(invitationDoc.workspace_id) !== workspaceId) {
        return NextResponse.json(
          { error: 'Invitation not in this workspace' },
          { status: 403 }
        );
      }

      if (invitationDoc.accepted_at) {
        return NextResponse.json(
          { error: 'Cannot resend an accepted invitation' },
          { status: 400 }
        );
      }

      if (invitationDoc.rejected_at) {
        return NextResponse.json(
          { error: 'Cannot resend a rejected invitation' },
          { status: 400 }
        );
      }

      const currentResentCount = invitationDoc.resent_count ?? 0;

      // Check resend limit (max 5 resends)
      if (currentResentCount >= 5) {
        return NextResponse.json(
          { error: 'Maximum resend limit reached. Please cancel and create a new invitation.' },
          { status: 400 }
        );
      }

      // Generate new token
      const newToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');

      // Extend expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const expiresAtIso = expiresAt.toISOString();
      const newResentCount = currentResentCount + 1;

      // Update invitation (mirrors the Supabase .update() field-for-field)
      await patchConvexDocumentByLegacyId('invitations', invitationId, {
        token: newToken,
        expires_at: expiresAtIso,
        resent_count: newResentCount,
        last_resent_at: new Date().toISOString(),
      });

      // TODO: Send invitation email
      // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${newToken}`;
      // await sendInvitationEmail(invitationDoc.email, inviteUrl, ...);

      // Mirror the Supabase .select('id, email, expires_at, resent_count') response.
      return NextResponse.json({
        success: true,
        invitation: {
          id: invitationDoc.id ?? invitationId,
          email: invitationDoc.email ?? null,
          expires_at: expiresAtIso,
          resent_count: newResentCount,
        },
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

    // Verify user can resend invitations
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
      .select('id, workspace_id, accepted_at, rejected_at, resent_count')
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
        { error: 'Cannot resend an accepted invitation' },
        { status: 400 }
      );
    }

    if (invitation.rejected_at) {
      return NextResponse.json(
        { error: 'Cannot resend a rejected invitation' },
        { status: 400 }
      );
    }

    // Check resend limit (max 5 resends)
    if (invitation.resent_count >= 5) {
      return NextResponse.json(
        { error: 'Maximum resend limit reached. Please cancel and create a new invitation.' },
        { status: 400 }
      );
    }

    // Generate new token
    const newToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');

    // Extend expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update invitation
    const { data: updatedInvitation, error: updateError } = await supabaseAdmin
      .from('invitations')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        resent_count: invitation.resent_count + 1,
        last_resent_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .select('id, email, expires_at, resent_count')
      .single();

    if (updateError) {
      console.error('[invitations] Error resending invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to resend invitation' },
        { status: 500 }
      );
    }

    // TODO: Send invitation email
    // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${newToken}`;
    // await sendInvitationEmail(invitation.email, inviteUrl, ...);

    return NextResponse.json({
      success: true,
      invitation: updatedInvitation,
    });
  } catch (error) {
    console.error('[invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
