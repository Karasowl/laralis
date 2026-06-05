/**
 * API: Chat Session by ID
 *
 * GET    /api/ai/sessions/[id] - Get session with messages
 * PATCH  /api/ai/sessions/[id] - Update session (archive, title)
 * DELETE /api/ai/sessions/[id] - Delete session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson } from '@/lib/validation'
import { forbiddenIfMissingPermission, type Permission } from '@/lib/permissions'
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Convex read replica of the GET payload. Convex has no joins: messages are
 * reassembled from the `chat_messages` table by matching `session_id`,
 * replicating the same order/range/count as the Supabase branch.
 */
async function getSessionMessagesFromConvex(
  clinicId: string,
  session: ImportedRecord,
  sessionId: string,
  limit: number,
  offset: number
) {
  // chat_messages has NO clinic_id column (it's scoped via session_id ->
  // chat_sessions -> clinic). listConvexDocumentsByClinic would match zero
  // rows; fetch the table and filter by session_id, exactly like the
  // Supabase query which scopes by session_id alone.
  const allMessages = (await listConvexTable('chat_messages', 10000) as ImportedRecord[])
    .filter((row) => String(row.session_id || '') === sessionId)
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))

  const total = allMessages.length
  const messages = allMessages
    .slice(offset, offset + limit)
    .map(normalizeConvexRecord)

  return {
    data: {
      session: normalizeConvexRecord(session),
      messages,
    },
    pagination: {
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    },
  }
}

// Schema for updating a session
const updateSessionSchema = z.object({
  title: z.string().max(255).optional(),
  is_archived: z.boolean().optional(),
  ended_at: z.string().datetime().optional(),
})

interface RouteContext {
  params: { id: string }
}

const laraPermissionForMode = (mode: string | null | undefined): Permission =>
  mode === 'query' ? 'lara.use_query_mode' : 'lara.use_entry_mode'

/**
 * GET /api/ai/sessions/[id]
 * Get session with all messages
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.id

    // Get session (verify ownership)
    const { data: chatSession, error: fetchError } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
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

    // Get messages
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Convex read branch (flag-gated). Runs only AFTER auth + ownership
    // (chat_sessions row matched by user_id) + clinic permission guard, since
    // the Convex bridge has no RLS. Byte-identical shape to the Supabase path.
    if (shouldReturnConvexData('chat_sessions')) {
      const payload = await getSessionMessagesFromConvex(
        chatSession.clinic_id,
        chatSession,
        sessionId,
        limit,
        offset
      )
      return NextResponse.json(payload)
    }

    const { data: messages, error: messagesError, count } = await supabaseAdmin
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (messagesError) {
      console.error('[API] Error fetching messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        session: chatSession,
        messages: messages || [],
      },
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/ai/sessions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai/sessions/[id]
 * Update session metadata
 */
export async function PATCH(
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
    const validation = updateSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const sessionId = params.id

    const { data: existingSession, error: existingError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, clinic_id, mode')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (existingError || !existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const forbidden = await forbiddenIfMissingPermission(
      session.user.id,
      existingSession.clinic_id,
      laraPermissionForMode(existingSession.mode)
    )
    if (forbidden) return forbidden

    // Update session (verify ownership via WHERE clause)
    const { data: updated, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[API] Error updating session:', error)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[API] Unexpected error in PATCH /api/ai/sessions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai/sessions/[id]
 * Delete session and all messages
 */
export async function DELETE(
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

    const sessionId = params.id

    const { data: existingSession, error: existingError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, clinic_id, mode')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (existingError || !existingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const forbidden = await forbiddenIfMissingPermission(
      session.user.id,
      existingSession.clinic_id,
      laraPermissionForMode(existingSession.mode)
    )
    if (forbidden) return forbidden

    // Delete session (cascade deletes messages)
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('[API] Error deleting session:', error)
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Unexpected error in DELETE /api/ai/sessions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
