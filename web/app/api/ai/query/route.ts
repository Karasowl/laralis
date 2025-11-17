/**
 * AI Query API Route
 *
 * POST /api/ai/query
 * Query database using AI with streaming support
 * For analytics/insights mode with Kimi K2 Thinking
 *
 * Uses Server-Sent Events (SSE) to avoid Vercel timeout on long-running queries
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { aiService } from '@/lib/ai'
import type { QueryContext } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for Kimi K2 Thinking

interface QueryRequest {
  query: string
  clinicId?: string
  locale?: string
}

export async function POST(request: NextRequest) {
  try {
    // Check if AI is configured
    if (!hasAIConfig()) {
      return new Response(
        JSON.stringify({ error: 'AI service is not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate configuration before using
    try {
      validateAIConfig()
    } catch (error) {
      console.error('[API /ai/query] Configuration error:', error)
      return new Response(
        JSON.stringify({ error: 'AI service configuration is invalid' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body: QueryRequest = await request.json()
    const { query, clinicId: requestedClinicId, locale = 'es' } = body

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: query' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Resolve clinic context (handles auth and access control automatically)
    const cookieStore = cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return new Response(
        JSON.stringify({ error: clinicContext.error.message }),
        { status: clinicContext.error.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { clinicId, userId } = clinicContext

    // Create Supabase client with auth
    const supabase = await createClient()

    // Build context for AI
    const context: QueryContext = {
      clinicId,
      locale,
      availableFunctions: [], // Will be filled by aiService
      supabase, // Pass authenticated Supabase client
    }

    // Get streaming response from AI
    const stream = await aiService.queryDatabaseStream(query, context)

    // Create SSE transformer to parse Kimi's streaming response
    const encoder = new TextEncoder()
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const decoder = new TextDecoder()
        const text = decoder.decode(chunk)
        const lines = text.split('\n').filter((line) => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6) // Remove 'data: ' prefix

            if (data === '[DONE]') {
              // Send final metadata
              const metadata = {
                userId,
                clinicId,
                timestamp: new Date().toISOString(),
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`)
              )
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              continue
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content

              if (content) {
                // Send content chunk
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`)
                )
              }
            } catch (e) {
              console.error('[API /ai/query] Failed to parse SSE chunk:', e)
            }
          }
        }
      },
    })

    // Pipe the stream through our transformer
    const transformedStream = stream.pipeThrough(transformStream)

    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })
  } catch (error) {
    console.error('[API /ai/query] Error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process query',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
