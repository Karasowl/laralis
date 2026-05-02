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

export const runtime = 'nodejs'
export const maxDuration = 30

const synthesizeRequestSchema = z.object({
  text: z.string().min(1, 'No text provided').max(500, 'Text too long (max 500 characters)'),
  voice: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
})

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
      console.error('[API /ai/synthesize] Configuration error:', error)
      return NextResponse.json(
        { error: 'AI service configuration is invalid' },
        { status: 503 }
      )
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

    // Synthesize using AI service
    const audioBuffer = await aiService.speakText(text, voice)

    // Return audio as response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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
}
