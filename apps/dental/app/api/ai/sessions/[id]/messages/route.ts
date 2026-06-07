/**
 * API: Chat Messages
 *
 * POST /api/ai/sessions/[id]/messages - Add message to session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson } from '@/lib/validation'
import { forbiddenIfMissingPermission, type Permission } from '@/lib/permissions'
import {
  getConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
  patchConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Convex ownership read mirroring the Supabase gate
 * `chat_sessions WHERE id = sessionId AND user_id = userId`. Returns the raw row
 * so the caller can read clinic_id/mode for the permission guard and replicate
 * the auto_generate_session_title trigger. Returns null when the session is
 * missing OR not owned by the user, matching the Supabase `.single()` 404.
 */
async function getOwnedSessionFromConvex(
  sessionId: string,
  userId: string
): Promise<ImportedRecord | null> {
  const row = (await getConvexDocumentByLegacyId('chat_sessions', sessionId)) as ImportedRecord | null
  if (!row || String(row.user_id || '') !== userId) return null
  return row
}

// Schema for creating a message
const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  thinking_process: z.string().optional(),
  model_used: z.string().max(50).optional(),
  tokens_used: z.number().int().positive().optional(),
  action_suggested: z.any().optional(),
  action_executed: z.boolean().optional(),
  action_result: z.any().optional(),
  entity_type: z.string().max(50).optional(),
  extracted_data: z.any().optional(),
  audio_duration_ms: z.number().int().positive().optional(),
})

interface RouteContext {
  params: { id: string }
}

const laraPermissionForMode = (mode: string | null | undefined): Permission =>
  mode === 'query' ? 'lara.use_query_mode' : 'lara.use_entry_mode'

/**
 * POST /api/ai/sessions/[id]/messages
 * Add a message to the session
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const supabase = createClient()

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate body
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const body = bodyResult.data
    const validation = createMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const sessionId = params.id

    // Convex-only write branch (flag-gated). Supabase is unreachable, so the
    // ownership read + message insert must go through Convex. Runs AFTER auth +
    // body validation; ownership and the Lara permission guard are enforced
    // exactly like the Supabase path before any write.
    if (shouldUseConvexOnlyWritePath('chat_messages')) {
      const ownedSession = await getOwnedSessionFromConvex(sessionId, session.user.id)
      if (!ownedSession) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      const forbidden = await forbiddenIfMissingPermission(
        session.user.id,
        ownedSession.clinic_id,
        laraPermissionForMode(ownedSession.mode)
      )
      if (forbidden) return forbidden

      // gen_random_uuid() + created_at DEFAULT NOW(): Convex has no column
      // defaults, so id/created_at/action_executed (DEFAULT FALSE) are stamped
      // explicitly to mirror the row Supabase's INSERT ... .select() returns.
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const message = {
        id,
        session_id: sessionId,
        ...validation.data,
        action_executed: validation.data.action_executed ?? false,
        created_at: createdAt,
      }
      await upsertConvexDocumentByLegacyId('chat_messages', id, message)

      // Replicate the two AFTER INSERT ON chat_messages triggers (migration 54):
      // 1) update_chat_session_stats: bump message_count, set last_message_at to
      //    the new message's created_at and updated_at to NOW().
      // 2) auto_generate_session_title: for a user message, set the session title
      //    to LEFT(content, 100) only when the session currently has no title.
      const sessionPatch: Record<string, unknown> = {
        message_count: Number(ownedSession.message_count || 0) + 1,
        last_message_at: createdAt,
        updated_at: new Date().toISOString(),
      }
      if (validation.data.role === 'user' && ownedSession.title == null) {
        sessionPatch.title = validation.data.content.slice(0, 100)
      }
      await patchConvexDocumentByLegacyId('chat_sessions', sessionId, sessionPatch)

      return NextResponse.json({ data: normalizeConvexRecord(message) }, { status: 201 })
    }

    // Verify session ownership
    const { data: chatSession, error: fetchError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, user_id, clinic_id, mode')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (fetchError || !chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const forbidden = await forbiddenIfMissingPermission(
      session.user.id,
      chatSession.clinic_id,
      laraPermissionForMode(chatSession.mode)
    )
    if (forbidden) return forbidden

    // Create message
    const { data: message, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        ...validation.data,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error creating message:', error)
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: message }, { status: 201 })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/ai/sessions/[id]/messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
