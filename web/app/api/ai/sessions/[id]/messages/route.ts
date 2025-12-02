/**
 * API: Chat Messages
 *
 * POST /api/ai/sessions/[id]/messages - Add message to session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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
    const body = await request.json()
    const validation = createMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const sessionId = params.id

    // Verify session ownership
    const { data: chatSession, error: fetchError } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single()

    if (fetchError || !chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

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
