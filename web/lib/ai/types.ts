/**
 * AI Provider Types
 *
 * Interfaces for interchangeable AI providers (STT, LLM, TTS).
 * Follows Strategy Pattern to allow switching providers without code changes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Common Types
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string | null
  name?: string // For function responses
  function_call?: {
    name: string
    arguments: string
  }
}

export interface Voice {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
}

// ============================================================================
// STT (Speech-to-Text) Provider Interface
// ============================================================================

export interface STTOptions {
  language?: string
  model?: string
  streaming?: boolean
}

export interface STTProvider {
  readonly name: string
  readonly supportsStreaming: boolean

  /**
   * Transcribe audio blob to text
   */
  transcribe(audio: Blob, options?: STTOptions): Promise<string>
}

// ============================================================================
// LLM (Large Language Model) Provider Interface
// ============================================================================

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

export interface AIFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface FunctionCall {
  name: string
  arguments: Record<string, unknown>
}

export interface LLMResponse {
  content: string | null
  functionCall?: FunctionCall
  thinkingProcess?: string // Only for models with thinking capability (e.g., Kimi K2)
}

export interface LLMProvider {
  readonly name: string
  readonly supportsThinking: boolean
  readonly supportsFunctionCalling: boolean

  /**
   * Simple chat completion
   */
  chat(messages: Message[], options?: LLMOptions): Promise<string>

  /**
   * Chat with function calling support
   */
  chatWithFunctions(
    messages: Message[],
    functions: AIFunction[],
    options?: LLMOptions
  ): Promise<LLMResponse>
}

// ============================================================================
// TTS (Text-to-Speech) Provider Interface
// ============================================================================

export interface TTSOptions {
  voice?: string
  speed?: number
  format?: 'mp3' | 'wav' | 'opus'
  language?: string
}

export interface VoiceInfo {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
  description?: string
}

export interface TTSProvider {
  readonly name: string
  readonly supportsStreaming?: boolean

  /**
   * Convert text to speech audio
   */
  synthesize(text: string, options?: TTSOptions): Promise<ArrayBuffer>

  /**
   * Get available voices for this provider
   */
  getSupportedVoices(): Promise<VoiceInfo[]>
}

// ============================================================================
// AI Service Types (High-level API)
// ============================================================================

export interface EntryContext {
  entityType: string
  schema: Record<string, unknown>
  currentField?: string
  collectedData?: Record<string, unknown>
  locale: string
}

export interface QueryContext {
  clinicId: string
  availableFunctions: AIFunction[]
  locale: string
  supabase?: SupabaseClient // Supabase client for direct queries
}

export interface QueryResult {
  answer: string
  data?: unknown
  thinking?: string
  visualizations?: unknown[]
}
