import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  listConvexTable,
  patchConvexDocumentByLegacyId,
} from '@/lib/convex/server';
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend';

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

// QA route contract: @qa-token-route public invitation rejection by opaque token.
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

  // Public-by-token endpoint (the unguessable token is the only credential), so the
  // flag-gated Convex-only write path needs no extra auth guard — it mirrors exactly
  // what the Supabase path does: look up the invitation by its unique token, then patch
  // rejected_at on that row (keyed by id = legacyId). When DATA_WRITE_MODE=convex,
  // Supabase is unreachable, so both the read and the write run against Convex.
  const useConvexOnly = shouldUseConvexOnlyWritePath('invitations');

  try {
    // Get invitation
    let invitation: { id: any; accepted_at: any; rejected_at: any; expires_at: any } | null;
    if (useConvexOnly) {
      const rows = (await listConvexTable('invitations', 10000) as ImportedRecord[]).map(normalizeConvexRecord);
      const found = rows.find((r) => r && r.token === token) ?? null;
      invitation = found
        ? {
            id: found.id,
            accepted_at: found.accepted_at,
            rejected_at: found.rejected_at,
            expires_at: found.expires_at,
          }
        : null;
    } else {
      const { data, error: invError } = await supabaseAdmin
        .from('invitations')
        .select('id, accepted_at, rejected_at, expires_at')
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
    if (useConvexOnly) {
      await patchConvexDocumentByLegacyId('invitations', String(invitation.id), {
        rejected_at: new Date().toISOString(),
      });
    } else {
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
