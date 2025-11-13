/**
 * AI Synthesize API Route
 *
 * POST /api/ai/synthesize
 * Convert text to speech using configured TTS provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 30

interface SynthesizeRequest {
  text: string
  voice?: string
  language?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SynthesizeRequest = await request.json()
    const { text, voice } = body

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Keep text short to avoid long processing times
    if (text.length > 500) {
      return NextResponse.json(
        { error: 'Text too long (max 500 characters)' },
        { status: 400 }
      )
    }

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
