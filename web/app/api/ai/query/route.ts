/**
 * AI Query API Route
 *
 * POST /api/ai/query
 * Query database using AI with function calling
 * For analytics/insights mode
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiService } from '@/lib/ai'
import type { QueryContext } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60 // Longer timeout for complex queries

interface QueryRequest {
  query: string
  clinicId: string
  locale?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: QueryRequest = await request.json()
    const { query, clinicId, locale = 'es' } = body

    if (!query || !clinicId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, clinicId' },
        { status: 400 }
      )
    }

    // Verify user has access to this clinic
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user membership
    const { data: membership, error: membershipError } = await supabase
      .from('user_clinic_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'User does not have access to this clinic' },
        { status: 403 }
      )
    }

    // Build context for AI
    const context: QueryContext = {
      clinicId,
      locale,
      availableFunctions: [], // Will be filled by aiService
    }

    // Query database using AI
    const result = await aiService.queryDatabase(query, context)

    return NextResponse.json({
      ...result,
      provider: aiService.getProviderInfo().llm,
      metadata: {
        userId: user.id,
        clinicId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[API /ai/query] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process query',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
