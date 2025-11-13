/**
 * AI Library - Public API
 *
 * This is the main entry point for the AI module.
 * Import from here instead of individual files.
 */

// Main service (use this in your app)
export { aiService, AIService } from './service'

// Types (for TypeScript users)
export type {
  STTProvider,
  LLMProvider,
  TTSProvider,
  Message,
  Voice,
  AIFunction,
  FunctionCall,
  LLMResponse,
  EntryContext,
  QueryContext,
  QueryResult,
  STTOptions,
  LLMOptions,
  TTSOptions,
} from './types'

// Factory (if you need to create custom instances)
export { AIProviderFactory } from './factory'

// Configuration (if you need to access config)
export { AI_CONFIG } from './config'
