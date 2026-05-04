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
import type { QueryContext, QueryResult, ConversationContextData } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { ConversationContextManager } from '@/lib/ai/context'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { forbiddenIfMissingPermission } from '@/lib/permissions'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for Kimi K2 Thinking

const queryRequestSchema = z.object({
  query: z.string().min(1),
  clinicId: z.string().uuid().optional(),
  locale: z.string().min(1).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      })
    )
    .optional(),
  model: z.enum(['kimi-k2-thinking', 'moonshot-v1-32k']).optional(),
})

const QA_STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

function isQaAiMockRequested(request: NextRequest) {
  return request.headers.get('x-laralis-qa-ai') === 'mock'
}

function isQaStage() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_STAGE_SUPABASE_REF))
}

function stageOnlyMockForbidden() {
  return new Response(
    JSON.stringify({ error: 'QA AI mock is only available on stage' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )
}

function createQaQueryResult(query: string): QueryResult {
  return {
    answer:
      `Lara QA respondio de forma deterministica para: "${query}". ` +
      'La clinica mantiene contexto activo y puede proponer una accion verificable.',
    thinking:
      'QA mock: no se llamo a ningun proveedor externo. Se genero una accion controlada para Cypress.',
    data: {
      source: 'qa-mock',
      checked: ['active_clinic', 'permissions', 'suggested_action'],
    },
    suggestedAction: {
      action: 'update_time_settings',
      params: {
        work_days: 25,
        hours_per_day: 7,
        real_productivity_pct: 82,
      },
      reasoning:
        'Ajustar la configuracion de tiempo permite verificar que Lara confirma acciones y persiste cambios reales en stage.',
      expected_impact: [
        {
          metric: 'Effective minutes/month',
          current_value: 8000,
          new_value: 8610,
          change_pct: 7.6,
        },
      ],
      confidence: 'high',
    },
  }
}

function streamQueryResult(result: QueryResult, userId: string, clinicId: string) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const answer = result.answer || ''
      const chunkSize = 10

      for (let i = 0; i < answer.length; i += chunkSize) {
        const chunk = answer.slice(i, i + chunkSize)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'content', data: chunk })}\n\n`)
        )
        await new Promise(resolve => setTimeout(resolve, 10))
      }

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

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const qaMockRequested = isQaAiMockRequested(request)
    if (qaMockRequested && !isQaStage()) {
      return stageOnlyMockForbidden()
    }

    // Check if AI is configured
    if (!qaMockRequested && !hasAIConfig()) {
      return new Response(
        JSON.stringify({ error: 'AI service is not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate configuration before using
    if (!qaMockRequested) {
      try {
        validateAIConfig()
      } catch (error) {
        console.error('[API /ai/query] Configuration error:', error)
        return new Response(
          JSON.stringify({ error: 'AI service configuration is invalid' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(queryRequestSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { query, clinicId: requestedClinicId, locale = 'es', conversationHistory, model } = parsed.data

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
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'lara.use_query_mode')
    if (forbidden) return forbidden

    // Create Supabase client with auth
    const supabase = await createClient()

    if (qaMockRequested) {
      return streamQueryResult(createQaQueryResult(query), userId, clinicId)
    }

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

    return streamQueryResult(result, userId, clinicId)
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
