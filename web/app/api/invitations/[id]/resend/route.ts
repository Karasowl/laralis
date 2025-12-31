import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

  try {
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

    if (!membership || !['owner', 'super_admin', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to resend invitations' },
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
