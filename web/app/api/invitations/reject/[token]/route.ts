import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/invitations/reject/[token]
 *
 * Reject an invitation. This is a public endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Get invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from('invitations')
      .select('id, accepted_at, rejected_at, expires_at')
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
        { error: 'Invitation was already accepted' },
        { status: 400 }
      );
    }

    if (invitation.rejected_at) {
      return NextResponse.json(
        { error: 'Invitation was already rejected' },
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

    // Mark invitation as rejected
    const { error: updateError } = await supabaseAdmin
      .from('invitations')
      .update({
        rejected_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('[invitations] Error rejecting invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation rejected',
    });
  } catch (error) {
    console.error('[invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
