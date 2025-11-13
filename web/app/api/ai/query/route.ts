/**
 * AI Query API Route
 *
 * POST /api/ai/query
 * Query database using AI with function calling
 * For analytics/insights mode
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { aiService } from '@/lib/ai'
import type { QueryContext } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'

export const runtime = 'nodejs'
export const maxDuration = 60 // Longer timeout for complex queries

interface QueryRequest {
  query: string
  clinicId?: string
  locale?: string
}

export async function POST(request: NextRequest) {
  try {
    // Check if AI is configured
    if (!hasAIConfig()) {
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 503 }
      )
    }

    // Validate configuration before using
    try {
      validateAIConfig()
    } catch (error) {
      console.error('[API /ai/query] Configuration error:', error)
      return NextResponse.json(
        { error: 'AI service configuration is invalid' },
        { status: 503 }
      )
    }
    const body: QueryRequest = await request.json()
    const { query, clinicId: requestedClinicId, locale = 'es' } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required field: query' },
        { status: 400 }
      )
    }

    // Resolve clinic context (handles auth and access control automatically)
    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId,
      cookieStore
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId, userId } = clinicContext

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
        userId,
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
