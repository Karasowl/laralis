/**
 * AI Transcribe API Route
 *
 * POST /api/ai/transcribe
 * Transcribes audio to text using configured STT provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { withAnyPermission } from '@/lib/middleware/with-permission'
import { LARA_ANY_MODE_PERMISSIONS, MAX_TRANSCRIBE_AUDIO_BYTES } from '@/lib/ai/route-guards'

export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds max for transcription

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
 * Auth gate: this route used to be fully public. It forwards audio to the paid STT
 * provider on the project's own API key, so an unauthenticated endpoint is an
 * uncapped billing hole for anyone who finds the URL. The only callers are
 * components/ai-assistant/VoiceRecorder.tsx (inside the Lara assistant), which only
 * renders on authenticated screens, so requiring a session plus either Lara mode
 * permission costs the real user nothing.
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
        console.error('[API /ai/transcribe] Configuration error:', error)
        return NextResponse.json(
          { error: 'AI service configuration is invalid' },
          { status: 503 }
        )
      }
    }
    // Get audio from form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const language = (formData.get('language') as string) || 'es'

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Cap the upload: the provider bills by audio length, and the route had no
    // size limit at all, so one caller could send arbitrarily large files.
    if (audioFile.size > MAX_TRANSCRIBE_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: 'Audio file too large',
          message: `Maximum size is ${Math.floor(MAX_TRANSCRIBE_AUDIO_BYTES / (1024 * 1024))}MB`,
        },
        { status: 413 }
      )
    }

    if (qaFailureRequested) {
      return NextResponse.json(
        {
          error: 'qa_stt_failure',
          message: 'QA forced Lara transcription failure',
          retryable: true,
        },
        { status: 503 }
      )
    }

    if (qaMockRequested) {
      return NextResponse.json({
        transcript: 'Lara QA transcribio audio de prueba',
        provider: 'qa-mock',
      })
    }

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type })

    // Transcribe using AI service
    const transcript = await aiService.transcribe(audioBlob, language)

    return NextResponse.json({
      transcript,
      provider: aiService.getProviderInfo().stt,
    })
  } catch (error) {
    console.error('[API /ai/transcribe] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to transcribe audio',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
