/**
 * AI Chat API Route
 *
 * POST /api/ai/chat
 * Chat with AI for data entry guidance
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'
import type { Message, EntryContext } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission, type Permission } from '@/lib/permissions'

export const runtime = 'nodejs'
export const maxDuration = 30

interface ChatRequest {
  userInput: string
  context?: EntryContext
  mode: 'entry' | 'simple'
}

interface EntryResponse {
  extracted_value: unknown
  message: string
  is_valid: boolean
  validation_error: string | null
}

const chatRequestSchema = z.object({
  userInput: z.string().min(1),
  mode: z.enum(['entry', 'simple']).optional().default('simple'),
  clinicId: z.string().uuid().optional(),
  context: z.unknown().optional(),
})

const QA_STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

type QaAiMode = 'mock' | 'fail' | null

function qaAiMode(request: NextRequest): QaAiMode {
  const mode = request.headers.get('x-laralis-qa-ai')
  return mode === 'mock' || mode === 'fail' ? mode : null
}

function isQaStage() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_STAGE_SUPABASE_REF))
}

function laraPermissionForMode(mode: 'entry' | 'simple'): Permission {
  return mode === 'entry' ? 'lara.use_entry_mode' : 'lara.use_query_mode'
}

function contextField(context: unknown): string | undefined {
  if (!context || typeof context !== 'object') return undefined
  const field = (context as { currentField?: unknown }).currentField
  return typeof field === 'string' ? field : undefined
}

function qaExtractEntryValue(field: string | undefined, userInput: string) {
  const value = userInput.trim()
  if (/^(skip|saltar|omitir)$/i.test(value)) return null

  if (!field) return value

  if (field.endsWith('_cents')) {
    const numeric = Number(value.replace(/[^\d.]/g, ''))
    return Number.isFinite(numeric) ? Math.round(numeric * 100) : null
  }

  if (
    field.endsWith('_pesos') ||
    [
      'est_minutes',
      'minutes',
      'work_days',
      'hours_per_day',
      'real_pct',
      'portions',
      'depreciation_months',
      'quantity',
    ].includes(field)
  ) {
    const numeric = Number(value.replace(/[^\d.]/g, ''))
    return Number.isFinite(numeric) ? numeric : null
  }

  if (field === 'gender') {
    const normalized = value.toLowerCase()
    if (['male', 'female', 'other'].includes(normalized)) return normalized
    if (['masculino', 'hombre'].includes(normalized)) return 'male'
    if (['femenino', 'mujer'].includes(normalized)) return 'female'
    return 'other'
  }

  return value
}

function createQaEntryResponse(userInput: string, context: unknown) {
  const field = contextField(context)
  const extractedValue = qaExtractEntryValue(field, userInput)

  return NextResponse.json({
    response: field
      ? `Lara QA capturo ${field} de forma deterministica.`
      : 'Lara QA capturo el dato de forma deterministica.',
    extracted_value: extractedValue,
    is_valid: true,
    validation_error: null,
    provider: 'qa-mock',
  })
}

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(chatRequestSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { userInput, context, mode, clinicId } = parsed.data as ChatRequest & { clinicId?: string }

    const clinicContext = await resolveClinicContext({
      requestedClinicId: clinicId,
      cookieStore: cookies(),
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
      laraPermissionForMode(mode)
    )
    if (forbidden) return forbidden

    const qaMode = qaAiMode(request)
    if (qaMode && !isQaStage()) {
      return NextResponse.json(
        { error: 'QA AI mode is only available on stage' },
        { status: 403 }
      )
    }

    if (qaMode === 'fail') {
      return NextResponse.json(
        {
          error: 'qa_entry_llm_failure',
          message: 'QA forced Lara entry mode failure',
          retryable: true,
        },
        { status: 503 }
      )
    }

    if (qaMode === 'mock' && mode === 'entry') {
      return createQaEntryResponse(userInput, context)
    }

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
      console.error('[API /ai/chat] Configuration error:', error)
      return NextResponse.json(
        { error: 'AI service configuration is invalid' },
        { status: 503 }
      )
    }

    let response: string

    if (mode === 'entry' && context) {
      // Entry mode with context
      response = await aiService.chatForEntry(userInput, context)

      // Try to parse JSON response for entry mode
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanResponse = response.trim()
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.slice(7)
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.slice(3)
        }
        if (cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(0, -3)
        }
        cleanResponse = cleanResponse.trim()

        const parsed: EntryResponse = JSON.parse(cleanResponse)

        return NextResponse.json({
          response: parsed.message,
          extracted_value: parsed.extracted_value,
          is_valid: parsed.is_valid,
          validation_error: parsed.validation_error,
          provider: aiService.getProviderInfo().llm,
        })
      } catch (parseError) {
        // If JSON parsing fails, return plain text response
        console.warn('[API /ai/chat] Failed to parse JSON response, using plain text:', parseError)
        return NextResponse.json({
          response,
          extracted_value: null,
          is_valid: false,
          validation_error: 'parse_error',
          provider: aiService.getProviderInfo().llm,
        })
      }
    } else {
      // Simple chat mode
      const messages: Message[] = [
        {
          role: 'user',
          content: userInput,
        },
      ]
      response = await aiService.chat(messages)

      return NextResponse.json({
        response,
        provider: aiService.getProviderInfo().llm,
      })
    }
  } catch (error) {
    console.error('[API /ai/chat] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get AI response',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
