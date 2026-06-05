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
import {
  forbiddenIfMissingPermission,
  userHasPermission,
  type Permission,
} from '@/lib/permissions'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

interface SessionListFilters {
  userId: string
  mode: 'entry' | 'query' | null
  includeArchived: boolean
  limit: number
  offset: number
}

async function getSessionsFromConvex(clinicId: string, filters: SessionListFilters) {
  const rows = await listConvexDocumentsByClinic('chat_sessions', clinicId, 10000) as ImportedRecord[]

  const filtered = rows.filter((row) => {
    if (row.user_id !== filters.userId) return false
    if (filters.mode && row.mode !== filters.mode) return false
    if (!filters.includeArchived && row.is_archived !== false) return false
    return true
  })

  filtered.sort((a, b) => String(b.last_message_at || '').localeCompare(String(a.last_message_at || '')))

  const total = filtered.length
  const page = filtered
    .slice(filters.offset, filters.offset + filters.limit)
    .map(normalizeConvexRecord)

  return {
    data: page,
    pagination: {
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: total > filters.offset + filters.limit,
    },
  }
}

// Schema for creating a session
const createSessionSchema = z.object({
  mode: z.enum(['entry', 'query']),
  title: z.string().max(255).optional(),
})

const laraPermissionForMode = (mode: 'entry' | 'query'): Permission =>
  mode === 'query' ? 'lara.use_query_mode' : 'lara.use_entry_mode'

async function forbiddenIfMissingAnyLaraAccess(userId: string, clinicId: string) {
  const [canEntry, canQuery] = await Promise.all([
    userHasPermission(userId, clinicId, 'lara.use_entry_mode'),
    userHasPermission(userId, clinicId, 'lara.use_query_mode'),
  ])

  if (canEntry || canQuery) return null

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: 'You do not have permission: lara.use_entry_mode or lara.use_query_mode',
    },
    { status: 403 }
  )
}

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
    const forbidden = mode
      ? await forbiddenIfMissingPermission(
        clinicContext.userId,
        clinicContext.clinicId,
        laraPermissionForMode(mode)
      )
      : await forbiddenIfMissingAnyLaraAccess(clinicContext.userId, clinicContext.clinicId)
    if (forbidden) return forbidden

    // Convex read branch (flag-gated). Auth + clinic access already verified by
    // resolveClinicContext (getUser + user_has_clinic_access -> 403) and Lara
    // permission gates above, so this is safe despite the Convex bridge lacking RLS.
    if (shouldReturnConvexData('chat_sessions')) {
      const result = await getSessionsFromConvex(clinicContext.clinicId, {
        userId: session.user.id,
        mode,
        includeArchived,
        limit,
        offset,
      })
      return NextResponse.json(result)
    }

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

    const forbidden = await forbiddenIfMissingPermission(
      clinicContext.userId,
      clinicContext.clinicId,
      laraPermissionForMode(validation.data.mode)
    )
    if (forbidden) return forbidden

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
