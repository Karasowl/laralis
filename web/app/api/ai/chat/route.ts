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

export const runtime = 'nodejs'
export const maxDuration = 30

interface ChatRequest {
  userInput: string
  context?: EntryContext
  mode: 'entry' | 'simple'
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
      console.error('[API /ai/chat] Configuration error:', error)
      return NextResponse.json(
        { error: 'AI service configuration is invalid' },
        { status: 503 }
      )
    }
    const body: ChatRequest = await request.json()
    const { userInput, context, mode } = body

    if (!userInput) {
      return NextResponse.json({ error: 'No user input provided' }, { status: 400 })
    }

    let response: string

    if (mode === 'entry' && context) {
      // Entry mode with context
      response = await aiService.chatForEntry(userInput, context)
    } else {
      // Simple chat mode
      const messages: Message[] = [
        {
          role: 'user',
          content: userInput,
        },
      ]
      response = await aiService.chat(messages)
    }

    return NextResponse.json({
      response,
      provider: aiService.getProviderInfo().llm,
    })
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
