/**
 * API: Chat Sessions
 *
 * GET  /api/ai/sessions - List user's chat sessions
 * POST /api/ai/sessions - Create new chat session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { z } from 'zod'
import { readJson } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// Schema for creating a session
const createSessionSchema = z.object({
  mode: z.enum(['entry', 'query']),
  title: z.string().max(255).optional(),
})

/**
 * GET /api/ai/sessions
 * List chat sessions for current user and clinic
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const cookieStore = cookies()
    const { searchParams } = new URL(request.url)

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve clinic context
    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    // Query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const mode = searchParams.get('mode') as 'entry' | 'query' | null
    const includeArchived = searchParams.get('includeArchived') === 'true'

    // Build query
    let query = supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicContext.clinicId)
      .eq('user_id', session.user.id)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (mode) {
      query = query.eq('mode', mode)
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data: sessions, error, count } = await query

    if (error) {
      console.error('[API] Error fetching chat sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: sessions,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/ai/sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/sessions
 * Create a new chat session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const cookieStore = cookies()

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
    const body = bodyResult.data as { clinicId?: string }
    const validation = createSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Resolve clinic context
    const clinicContext = await resolveClinicContext({
      requestedClinicId: body.clinicId,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    // Create session
    const { data: newSession, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        clinic_id: clinicContext.clinicId,
        user_id: session.user.id,
        mode: validation.data.mode,
        title: validation.data.title,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error creating chat session:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: newSession }, { status: 201 })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/ai/sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
