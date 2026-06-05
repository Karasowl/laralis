/**
 * API: AI Feedback
 *
 * POST /api/ai/feedback - Submit feedback on AI response
 * GET  /api/ai/feedback - Get feedback stats (for analytics)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { z } from 'zod'
import { readJson } from '@/lib/validation'
import { forbiddenIfMissingPermission, userHasPermission } from '@/lib/permissions'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

// Schema for feedback
const feedbackSchema = z.object({
  message_id: z.string().uuid(),
  rating: z.enum(['positive', 'negative']),
  comment: z.string().max(1000).optional(),
  query_type: z.string().max(50).optional(),
})

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

/**
 * Convex read replica of the GET feedback-stats aggregation.
 * Convex has no joins; ai_feedback rows already carry clinic_id and the
 * rating/query_type fields, so we fetch by clinic and replicate the SAME
 * filter/aggregation the Supabase path performs (byte-identical shape).
 */
async function getFeedbackStatsFromConvex(clinicId: string) {
  const rows = (await listConvexDocumentsByClinic('ai_feedback', clinicId, 10000) as ImportedRecord[])
    .map(normalizeConvexRecord)

  const total = rows.length || 0
  const positive = rows.filter((f) => f.rating === 'positive').length || 0
  const negative = rows.filter((f) => f.rating === 'negative').length || 0

  const byQueryType: Record<string, { positive: number; negative: number }> = {}
  rows.forEach((f) => {
    const type = f.query_type || 'unknown'
    if (!byQueryType[type]) {
      byQueryType[type] = { positive: 0, negative: 0 }
    }
    byQueryType[type][f.rating as 'positive' | 'negative']++
  })

  return {
    total,
    positive,
    negative,
    satisfaction_rate: total > 0 ? Math.round((positive / total) * 100) : null,
    by_query_type: byQueryType,
  }
}

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
 * POST /api/ai/feedback
 * Submit feedback on an AI response
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
    const validation = feedbackSchema.safeParse(body)

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

    const forbidden = await forbiddenIfMissingAnyLaraAccess(session.user.id, clinicContext.clinicId)
    if (forbidden) return forbidden

    // Verify message exists and belongs to user's session
    const { data: message, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        id,
        session:chat_sessions!inner(user_id)
      `)
      .eq('id', validation.data.message_id)
      .single()

    if (msgError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Check if user owns the session
    // The join returns an array with !inner, so we access first element
    const sessionArray = message.session as unknown as { user_id: string }[]
    const sessionData = sessionArray[0]
    if (!sessionData || sessionData.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized to provide feedback on this message' },
        { status: 403 }
      )
    }

    // Check for existing feedback
    const { data: existing } = await supabaseAdmin
      .from('ai_feedback')
      .select('id')
      .eq('message_id', validation.data.message_id)
      .eq('user_id', session.user.id)
      .single()

    if (existing) {
      // Update existing feedback
      const { data: updated, error } = await supabaseAdmin
        .from('ai_feedback')
        .update({
          rating: validation.data.rating,
          comment: validation.data.comment,
          query_type: validation.data.query_type,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[API] Error updating feedback:', error)
        return NextResponse.json(
          { error: 'Failed to update feedback' },
          { status: 500 }
        )
      }

      return NextResponse.json({ data: updated })
    }

    // Create new feedback
    const { data: feedback, error } = await supabaseAdmin
      .from('ai_feedback')
      .insert({
        message_id: validation.data.message_id,
        clinic_id: clinicContext.clinicId,
        user_id: session.user.id,
        rating: validation.data.rating,
        comment: validation.data.comment,
        query_type: validation.data.query_type,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error creating feedback:', error)
      return NextResponse.json(
        { error: 'Failed to create feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: feedback }, { status: 201 })
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/ai/feedback:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/feedback
 * Get feedback statistics for the clinic
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

    const forbidden = await forbiddenIfMissingPermission(
      session.user.id,
      clinicContext.clinicId,
      'lara.use_query_mode'
    )
    if (forbidden) return forbidden

    // Convex read branch (flag-gated). Placed AFTER auth (getSession),
    // clinic-access verification (resolveClinicContext enforces a 403 when
    // the user is not a member of the requested clinic) and the Lara
    // permission check, so the Convex bridge (which has no RLS) is reached
    // with the same authorization guarantees as the Supabase path.
    if (shouldReturnConvexData('ai_feedback')) {
      const data = await getFeedbackStatsFromConvex(clinicContext.clinicId)
      return NextResponse.json({ data })
    }

    // Get feedback stats
    const { data: feedback, error } = await supabaseAdmin
      .from('ai_feedback')
      .select('rating, query_type')
      .eq('clinic_id', clinicContext.clinicId)

    if (error) {
      console.error('[API] Error fetching feedback:', error)
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      )
    }

    // Calculate stats
    const total = feedback?.length || 0
    const positive = feedback?.filter(f => f.rating === 'positive').length || 0
    const negative = feedback?.filter(f => f.rating === 'negative').length || 0

    // Group by query type
    const byQueryType: Record<string, { positive: number; negative: number }> = {}
    feedback?.forEach(f => {
      const type = f.query_type || 'unknown'
      if (!byQueryType[type]) {
        byQueryType[type] = { positive: 0, negative: 0 }
      }
      byQueryType[type][f.rating as 'positive' | 'negative']++
    })

    return NextResponse.json({
      data: {
        total,
        positive,
        negative,
        satisfaction_rate: total > 0 ? Math.round((positive / total) * 100) : null,
        by_query_type: byQueryType,
      },
    })
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/ai/feedback:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
