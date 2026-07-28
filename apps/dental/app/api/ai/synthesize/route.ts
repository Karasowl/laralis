/**
 * AI Synthesize API Route
 *
 * POST /api/ai/synthesize
 * Convert text to speech using configured TTS provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { withAnyPermission } from '@/lib/middleware/with-permission'
import { LARA_ANY_MODE_PERMISSIONS, MAX_SYNTHESIZE_TEXT_CHARS } from '@/lib/ai/route-guards'

export const runtime = 'nodejs'
export const maxDuration = 30

const synthesizeRequestSchema = z.object({
  text: z
    .string()
    .min(1, 'No text provided')
    .max(MAX_SYNTHESIZE_TEXT_CHARS, `Text too long (max ${MAX_SYNTHESIZE_TEXT_CHARS} characters)`),
  voice: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
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

/**
 * Auth gate: see lib/ai/route-guards.ts. This route was fully public and calls the
 * paid TTS provider on the project's own key. Its only caller is
 * components/ai-assistant/AudioPlayer.tsx, inside the authenticated Lara assistant.
 */
export const POST = withAnyPermission(LARA_ANY_MODE_PERMISSIONS, async (request) => {
  try {
    const qaMode = qaAiMode(request)
    const qaMockRequested = qaMode === 'mock'
    const qaFailureRequested = qaMode === 'fail'
    if (qaMode && !isQaStage()) {
      return NextResponse.json(
        { error: 'QA AI mode is only available on stage' },
        { status: 403 }
      )
    }

    // Check if AI is configured
    if (!qaMode && !hasAIConfig()) {
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 503 }
      )
    }

    // Validate configuration before using
    if (!qaMode) {
      try {
        validateAIConfig()
      } catch (error) {
        console.error('[API /ai/synthesize] Configuration error:', error)
        return NextResponse.json(
          { error: 'AI service configuration is invalid' },
          { status: 503 }
        )
      }
    }
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(synthesizeRequestSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { text, voice } = parsed.data

    if (qaFailureRequested) {
      return NextResponse.json(
        {
          error: 'qa_tts_failure',
          message: 'QA forced Lara speech synthesis failure',
          retryable: true,
        },
        { status: 503 }
      )
    }

    if (qaMockRequested) {
      const audioBuffer = new TextEncoder().encode(`qa-mock-audio:${text}`).buffer
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'no-store',
        },
      })
    }

    // Synthesize using AI service
    const audioBuffer = await aiService.speakText(text, voice)

    // Return audio as response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        // `private`, not `public`: the response is now behind a session and can
        // contain clinic-specific text read aloud, so it must not sit in a shared cache.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[API /ai/synthesize] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to synthesize speech',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
