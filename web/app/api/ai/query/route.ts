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
import type { QueryContext, ConversationContextData } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { ConversationContextManager } from '@/lib/ai/context'

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

    // Build conversation context from history using ConversationContextManager
    let conversationContextData: ConversationContextData | undefined
    if (conversationHistory && conversationHistory.length > 0) {
      const contextManager = new ConversationContextManager(
        `query-${Date.now()}`, // Session ID
        clinicId
      )

      // Process each message in history to build context
      conversationHistory.forEach((msg, index) => {
        if (msg.role === 'user') {
          contextManager.processUserMessage(msg.content, index)
        } else {
          contextManager.processAssistantMessage(msg.content, index)
        }
      })

      // Also process the current query
      contextManager.processUserMessage(query, conversationHistory.length)

      // Get the built context
      const ctx = contextManager.getContext()
      if (ctx.focus.primaryEntity || ctx.focus.timePeriod || ctx.focus.currentTopic) {
        conversationContextData = {
          primaryEntity: ctx.focus.primaryEntity ? {
            type: ctx.focus.primaryEntity.type,
            name: ctx.focus.primaryEntity.name,
            id: ctx.focus.primaryEntity.id,
          } : undefined,
          secondaryEntities: ctx.focus.secondaryEntities.map(e => ({
            type: e.type,
            name: e.name,
          })),
          timePeriod: ctx.focus.timePeriod ? {
            label: ctx.focus.timePeriod.label,
            startDate: ctx.focus.timePeriod.startDate,
            endDate: ctx.focus.timePeriod.endDate,
          } : undefined,
          currentTopic: ctx.focus.currentTopic,
          pendingActions: ctx.actions.filter(a => a.status === 'suggested').map(a => a.type),
          summary: ctx.summary,
        }
      }
    }

    // Build context for AI
    const context: QueryContext = {
      clinicId,
      locale,
      availableFunctions: [], // Will be filled by aiService
      supabase, // Pass authenticated Supabase client
      conversationHistory, // Optional: last 10 messages for context
      model: model || 'kimi-k2-thinking', // Default to K2 Thinking if not specified
      conversationContext: conversationContextData, // Multi-turn context
    }

    // Get full response from AI (includes function calling for actions)
    const result = await aiService.queryDatabase(query, context)

    // Create synthetic stream from result
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Stream the answer in chunks (simulate streaming for UX)
        const answer = result.answer || ''
        const chunkSize = 10 // Characters per chunk

        for (let i = 0; i < answer.length; i += chunkSize) {
          const chunk = answer.slice(i, i + chunkSize)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'content', data: chunk })}\n\n`)
          )
          // Small delay to simulate streaming (improves perceived responsiveness)
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        // Send metadata at the end
        const metadata = {
          thinking: result.thinking,
          data: result.data,
          suggestedAction: result.suggestedAction,
          userId,
          clinicId,
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`)
        )

        // Send DONE signal
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    const transformedStream = stream

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
