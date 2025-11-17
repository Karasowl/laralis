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
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: 'kimi-k2-thinking' | 'moonshot-v1-32k'
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
    const { query, clinicId: requestedClinicId, locale = 'es', conversationHistory, model } = body

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
      conversationHistory, // Optional: last 10 messages for context
      model: model || 'kimi-k2-thinking', // Default to K2 Thinking if not specified
    }

    // Get streaming response from AI
    const stream = await aiService.queryDatabaseStream(query, context)

    // Create SSE transformer to parse Kimi's streaming response with buffering
    const encoder = new TextEncoder()
    let buffer = '' // Buffer for incomplete chunks

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const decoder = new TextDecoder()
        const text = decoder.decode(chunk, { stream: true })

        // Add to buffer
        buffer += text

        // Split by newlines but keep the last incomplete line in buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          const data = line.slice(6).trim() // Remove 'data: ' prefix

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
            const delta = parsed.choices?.[0]?.delta

            // Capture reasoning_content (thinking process from K2 model)
            // This prevents timeout during long thinking phases (>60s)
            if (delta?.reasoning_content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'thinking', data: delta.reasoning_content })}\n\n`)
              )
            }

            // Capture content (final answer)
            if (delta?.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'content', data: delta.content })}\n\n`)
              )
            }
          } catch (e) {
            // Skip unparseable chunks (might be incomplete)
            console.debug('[API /ai/query] Skipping unparseable chunk (might be incomplete)')
          }
        }
      },

      flush(controller) {
        // Process any remaining data in buffer
        if (buffer.trim() && buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim()
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta

              // Capture reasoning_content (thinking process)
              if (delta?.reasoning_content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'thinking', data: delta.reasoning_content })}\n\n`)
                )
              }

              // Capture content (final answer)
              if (delta?.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', data: delta.content })}\n\n`)
                )
              }
            } catch (e) {
              console.debug('[API /ai/query] Skipping final unparseable chunk')
            }
          }
        }
      }
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

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Extract status code from Kimi error message (e.g., "Kimi API error: 429 - ...")
    const statusMatch = errorMessage.match(/Kimi API error: (\d+)/)
    const status = statusMatch ? parseInt(statusMatch[1]) : 500

    // Determine error type for client
    let errorType = 'server_error'
    if (status === 429) {
      errorType = 'overloaded'
    } else if (status === 503) {
      errorType = 'server_error'
    } else if (status >= 400 && status < 500) {
      errorType = 'client_error'
    }

    return new Response(
      JSON.stringify({
        error: errorType,
        message: errorMessage,
        retryable: status === 429 || status === 503, // Suggest retry for temporary errors
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
